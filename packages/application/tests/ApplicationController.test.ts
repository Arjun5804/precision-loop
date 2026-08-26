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
import { ApplicationStateError, ApplicationDependencyError } from '../src/errors';

describe('ApplicationController', () => {
    let mockEngineLoop: EngineLoop;
    let config: ApplicationConfig;
    let controller: ApplicationController;

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockEngineLoop = {
            start: vi.fn(),
            stop: vi.fn()
        };
        
        config = {
            recordingWorkletUrl: 'record.js',
            foundationWorkletUrl: 'foundation.js',
            sessionLeadTimeSeconds: 0.1
        };
        
        // Mock AudioEngine context and time source
        vi.mocked(AudioEngine.prototype.createAudioTimeSource).mockReturnValue({
            currentTime: () => 10.0
        });
        
        Object.defineProperty(AudioEngine.prototype, 'context', {
            get: () => ({ sampleRate: 48000 }),
            configurable: true
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

    it('should execute recording flow', async () => {
        await controller.initialize();
        
        const track = controller.session.createTrack();
        
        // Mock Transport start and getTake
        vi.mocked(Transport.prototype.start).mockResolvedValue(undefined);
        vi.mocked(Transport.prototype.getTake).mockReturnValue({
            id: 't1',
            sampleRate: 48000,
            channelCount: 1,
            frameCount: 48000,
            channels: [new Float32Array(48000)],
            startTime: 10.1,
            endTime: 11.1
        });

        await controller.startRecording(track.id, 1, 1);
        
        expect(Transport).toHaveBeenCalledTimes(1);
        expect(Transport.prototype.start).toHaveBeenCalledWith(10.1, 'record.js');
        expect(controller.getState()).toBe('IDLE');
        
        // Verify domain mutation
        expect(track.getLoop()).not.toBeNull();
        expect(track.getLoop()!.take.frameCount).toBe(48000);
    });

    it('should ignore stale recording completion if stop is called', async () => {
        await controller.initialize();
        const track = controller.session.createTrack();
        
        // Make Transport.start block
        let resolveStart: () => void;
        vi.mocked(Transport.prototype.start).mockReturnValue(new Promise(resolve => {
            resolveStart = resolve;
        }));
        
        const recordPromise = controller.startRecording(track.id, 1, 1);
        
        // Controller is RECORDING
        expect(controller.getState()).toBe('RECORDING');
        
        // Stop called mid-recording
        controller.stop();
        expect(controller.getState()).toBe('IDLE');
        
        // Transport completes (stale)
        vi.mocked(Transport.prototype.getTake).mockReturnValue({
            id: 't1', sampleRate: 48000, channelCount: 1, frameCount: 48000,
            channels: [new Float32Array(48000)], startTime: 10.1, endTime: 11.1
        });
        resolveStart!();
        
        await recordPromise;
        
        // Domain should not be mutated because it was cancelled
        expect(track.getLoop()).toBeNull();
    });

    it('should execute playback flow', async () => {
        await controller.initialize();
        
        // Create a loop to play
        const track = controller.session.createTrack();
        const take = controller.session.createTake({
            sampleRate: 48000, channelCount: 1, frameCount: 48000, channels: [new Float32Array(48000)]
        });
        track.setLoop(controller.session.createLoop({ take, musicalLength: { bars: 1 } }));
        
        controller.startPlayback();
        
        expect(controller.getState()).toBe('PLAYING');
        expect(PlaybackEngine.prototype.start).toHaveBeenCalled();
    });

    it('should stop and transition to IDLE', async () => {
        await controller.initialize();
        controller.startPlayback();
        expect(controller.getState()).toBe('PLAYING');
        
        controller.stop();
        expect(controller.getState()).toBe('IDLE');
        expect(PlaybackEngine.prototype.cancel).toHaveBeenCalled();
    });
});
