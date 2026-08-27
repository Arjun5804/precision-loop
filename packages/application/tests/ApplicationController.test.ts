import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplicationController } from '../src/ApplicationController';
import { EngineLoop } from '../src/EngineLoop';
import { ApplicationConfig } from '../src/types';

vi.mock('@precision-loop/audio-engine');
vi.mock('@precision-loop/audio-scheduler');
vi.mock('@precision-loop/recording-engine');
vi.mock('@precision-loop/playback-engine');
vi.mock('@precision-loop/transport');

import { AudioEngine } from '@precision-loop/audio-engine';
import { Transport } from '@precision-loop/transport';
import { PlaybackEngine } from '@precision-loop/playback-engine';
import { ApplicationStateError } from '../src/errors';

describe('ApplicationController', () => {
    let mockEngineLoop: EngineLoop;
    let config: ApplicationConfig;
    let controller: ApplicationController;

    beforeEach(() => {
        vi.clearAllMocks();
        mockEngineLoop = { start: vi.fn(), stop: vi.fn() };
        config = { recordingWorkletUrl: 'record.js', foundationWorkletUrl: 'foundation.js', sessionLeadTimeSeconds: 0.1 };
        vi.mocked(AudioEngine.prototype.createAudioTimeSource).mockReturnValue({ currentTime: () => 10.0 });
        Object.defineProperty(AudioEngine.prototype, 'context', {
            get: () => ({ sampleRate: 48000 }), configurable: true
        });
        Object.defineProperty(PlaybackEngine.prototype, 'hasActivePlayback', {
            value: vi.fn().mockReturnValue(false), configurable: true
        });
        controller = new ApplicationController(config, mockEngineLoop);
    });

    it('should initialize successfully', async () => {
        await expect(controller.initialize()).resolves.not.toThrow();
        expect(mockEngineLoop.start).toHaveBeenCalled();
        expect(controller.getState()).toBe('IDLE');
    });

    it('should throw if startRecording is called on non-existent track', async () => {
        await controller.initialize();
        await expect(controller.startRecording('missing-track', 1, 1)).rejects.toThrow(ApplicationStateError);
    });

    it('should remain PREPARING until the recording runtime reports actual recording', async () => {
        await controller.initialize();
        const track = controller.session.createTrack();
        let resolveStart!: () => void;
        vi.mocked(Transport.prototype.start).mockReturnValue(new Promise(resolve => { resolveStart = resolve; }));
        vi.mocked(Transport.prototype.subscribe).mockImplementation((listener: any) => {
            listener('ARMING', null);
            return vi.fn();
        });

        const promise = controller.startRecording(track.id, 1, 1);
        expect(controller.getState()).toBe('PREPARING');

        resolveStart();
        vi.mocked(Transport.prototype.getTake).mockReturnValue({
            id: 't1', sampleRate: 48000, channelCount: 1, frameCount: 48000,
            channels: [new Float32Array(48000)], startTime: 10.1, endTime: 11.1
        });
        await promise;
        expect(controller.getState()).toBe('PLAYING');
        expect(track.getLoop()).not.toBeNull();
        expect(PlaybackEngine.prototype.start).toHaveBeenCalled();
    });

    it('should execute recording flow and automatically start the new loop', async () => {
        await controller.initialize();
        const track = controller.session.createTrack();
        vi.mocked(Transport.prototype.start).mockResolvedValue(undefined);
        vi.mocked(Transport.prototype.getTake).mockReturnValue({
            id: 't1', sampleRate: 48000, channelCount: 1, frameCount: 48000,
            channels: [new Float32Array(48000)], startTime: 10.1, endTime: 11.1
        });

        await controller.startRecording(track.id, 1, 1);

        expect(Transport).toHaveBeenCalledTimes(1);
        expect(Transport.prototype.start).toHaveBeenCalledWith(10.1, 'record.js');
        expect(track.getLoop()).not.toBeNull();
        expect(PlaybackEngine.prototype.start).toHaveBeenCalledTimes(1);
        expect(controller.getState()).toBe('PLAYING');
    });

    it('should ignore stale recording completion if stop is called', async () => {
        await controller.initialize();
        const track = controller.session.createTrack();
        let resolveStart!: () => void;
        vi.mocked(Transport.prototype.start).mockReturnValue(new Promise(resolve => { resolveStart = resolve; }));

        const recordPromise = controller.startRecording(track.id, 1, 1);
        expect(controller.getState()).toBe('PREPARING');
        controller.stop();
        expect(controller.getState()).toBe('IDLE');

        vi.mocked(Transport.prototype.getTake).mockReturnValue({
            id: 't1', sampleRate: 48000, channelCount: 1, frameCount: 48000,
            channels: [new Float32Array(48000)], startTime: 10.1, endTime: 11.1
        });
        resolveStart();
        await recordPromise;
        expect(track.getLoop()).toBeNull();
    });

    it('should execute playback flow', async () => {
        await controller.initialize();
        const track = controller.session.createTrack();
        const take = controller.session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 48000, channels: [new Float32Array(48000)] });
        track.setLoop(controller.session.createLoop({ take, musicalLength: { bars: 1 } }));
        controller.startPlayback();
        expect(controller.getState()).toBe('PLAYING');
        expect(PlaybackEngine.prototype.start).toHaveBeenCalled();
    });

    it('can start a loop while another track is recording without changing recording state', async () => {
        await controller.initialize();
        const recordingTrack = controller.session.createTrack();
        const playbackTrack = controller.session.createTrack();
        const take = controller.session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 48000, channels: [new Float32Array(48000)] });
        playbackTrack.setLoop(controller.session.createLoop({ take, musicalLength: { bars: 1 } }));

        vi.mocked(Transport.prototype.start).mockReturnValue(new Promise(() => {}));
        void controller.startRecording(recordingTrack.id, 1, 1);
        expect(controller.getState()).toBe('PREPARING');
        controller.startTrackPlayback(playbackTrack.id);
        expect(PlaybackEngine.prototype.start).toHaveBeenCalled();
        expect(controller.getState()).toBe('PREPARING');
    });

    it('can stop one track while another remains active', async () => {
        await controller.initialize();
        const track1 = controller.session.createTrack();
        const track2 = controller.session.createTrack();
        const take1 = controller.session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 48000, channels: [new Float32Array(48000)] });
        const take2 = controller.session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 48000, channels: [new Float32Array(48000)] });
        track1.setLoop(controller.session.createLoop({ take: take1, musicalLength: { bars: 1 } }));
        track2.setLoop(controller.session.createLoop({ take: take2, musicalLength: { bars: 1 } }));

        const activeTracks = new Set<string>();
        vi.mocked(PlaybackEngine.prototype.hasActivePlayback).mockImplementation(() => activeTracks.size > 0);
        vi.mocked(PlaybackEngine.prototype.isTrackPlaying).mockImplementation((id: string) => activeTracks.has(id));
        vi.mocked(PlaybackEngine.prototype.start).mockImplementation((_plan: any, ids?: ReadonlySet<string>) => {
            ids?.forEach(id => activeTracks.add(id));
            if (!ids) { track1.id; track2.id; }
        });
        vi.mocked(PlaybackEngine.prototype.startTrack).mockImplementation((id: string) => { activeTracks.add(id); });
        vi.mocked(PlaybackEngine.prototype.stopTrack).mockImplementation((id: string) => { activeTracks.delete(id); });

        controller.startTrackPlayback(track1.id);
        controller.startTrackPlayback(track2.id);
        expect(controller.isTrackPlaying(track1.id)).toBe(true);
        expect(controller.isTrackPlaying(track2.id)).toBe(true);

        controller.stopTrack(track1.id);
        expect(controller.isTrackPlaying(track1.id)).toBe(false);
        expect(controller.isTrackPlaying(track2.id)).toBe(true);
        expect(controller.getState()).toBe('PLAYING');
    });

    it('should stop and transition to IDLE', async () => {
        await controller.initialize();
        const track = controller.session.createTrack();
        const take = controller.session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 48000, channels: [new Float32Array(48000)] });
        track.setLoop(controller.session.createLoop({ take, musicalLength: { bars: 1 } }));
        controller.startPlayback();
        expect(controller.getState()).toBe('PLAYING');
        controller.stop();
        expect(controller.getState()).toBe('IDLE');
        expect(PlaybackEngine.prototype.cancel).toHaveBeenCalled();
    });
});
