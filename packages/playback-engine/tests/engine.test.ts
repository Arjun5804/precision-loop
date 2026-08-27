import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaybackEngine } from '../src/engine';
import { FakeResourceAdapter } from '../src/fake-resource-adapter';
import { AudioScheduler, AudioTimeSource } from '@precision-loop/audio-scheduler';
import { PlaybackPlan } from '../src/playback-plan';
import { Take } from '@precision-loop/loop-model';
import { InvalidPlaybackPlanError } from '../src/errors';

describe('PlaybackEngine', () => {
  let adapter: FakeResourceAdapter;
  let audioScheduler: AudioScheduler;
  let engine: PlaybackEngine;
  let timeSource: AudioTimeSource;
  let mockTime = 0;
  let plan: PlaybackPlan;

  beforeEach(() => {
    adapter = new FakeResourceAdapter();
    mockTime = 0;
    timeSource = { currentTime: () => mockTime };
    const dummySink = { schedule: () => {} };
    audioScheduler = new AudioScheduler(timeSource, dummySink, { lookahead: 0.5 });
    audioScheduler.start();
    engine = new PlaybackEngine(adapter, audioScheduler, timeSource, 2.0);

    const originalTick = audioScheduler.tick.bind(audioScheduler);
    audioScheduler.tick = () => {
      const res = originalTick();
      for (const ev of res.scheduled) engine.schedule(ev);
      return res;
    };

    const dummyTake = new Take({
      id: 'take-1',
      sessionId: 'sess-1',
      sampleRate: 48000,
      channelCount: 1,
      frameCount: 48000,
      channels: [new Float32Array(48000)]
    });

    plan = {
      sessionId: 'sess-1',
      playbackSessionId: 'pb-1',
      originTime: 10.0,
      tracks: [
        {
          trackId: 'track-1', take: dummyTake, iterationDuration: 1.0,
          volume: 1.0, pan: 0, muted: false, soloed: false
        }
      ]
    };
  });

  it('rejects invalid plan with mismatched iterationDuration', () => {
    plan.tracks[0].iterationDuration = 1.5;
    expect(() => engine.start(plan)).toThrow(InvalidPlaybackPlanError);
  });

  it('accepts valid plan with small floating-point difference in duration', () => {
    plan.tracks[0].iterationDuration = 1.0 + 0.0005;
    expect(() => engine.start(plan)).not.toThrow();
  });

  it('rejects invalid plan', () => {
    plan.originTime = -1;
    expect(() => engine.start(plan)).toThrow(InvalidPlaybackPlanError);
  });

  it('starts playback and schedules nodes upon tick', () => {
    engine.start(plan);
    mockTime = 10.0;
    engine.replenish();
    audioScheduler.tick();

    expect(adapter.createdBuffers.length).toBe(1);
    expect(adapter.createdSources.length).toBe(1);
    expect(adapter.createdSources[0].startedAt).toBe(10.0);
    expect(adapter.createdSources[0].stoppedAt).toBe(11.0);
  });

  it('can start a plan with only the requested track active', () => {
    const take2 = new Take({
      id: 'take-2', sessionId: 'sess-1', sampleRate: 48000, channelCount: 1,
      frameCount: 48000, channels: [new Float32Array(48000)]
    });
    plan.tracks.push({
      trackId: 'track-2', take: take2, iterationDuration: 1.0,
      volume: 1.0, pan: 0, muted: false, soloed: false
    });

    engine.start(plan, new Set(['track-2']));
    expect(engine.isTrackPlaying('track-1')).toBe(false);
    expect(engine.isTrackPlaying('track-2')).toBe(true);

    mockTime = 10.0;
    audioScheduler.tick();
    expect(adapter.createdSources.length).toBe(1);
  });

  it('allows independently starting and stopping tracks without cancelling the session', () => {
    const take2 = new Take({
      id: 'take-2', sessionId: 'sess-1', sampleRate: 48000, channelCount: 1,
      frameCount: 48000, channels: [new Float32Array(48000)]
    });
    plan.tracks.push({
      trackId: 'track-2', take: take2, iterationDuration: 1.0,
      volume: 1.0, pan: 0, muted: false, soloed: false
    });

    engine.start(plan, new Set(['track-1']));
    engine.startTrack('track-2');
    expect(engine.hasActivePlayback()).toBe(true);
    expect(engine.isTrackPlaying('track-1')).toBe(true);
    expect(engine.isTrackPlaying('track-2')).toBe(true);

    engine.stopTrack('track-1');
    expect(engine.isTrackPlaying('track-1')).toBe(false);
    expect(engine.isTrackPlaying('track-2')).toBe(true);
    expect(engine.hasActivePlayback()).toBe(true);
  });

  it('cancels playback and stops active nodes immediately', () => {
    engine.start(plan);
    mockTime = 10.0;
    engine.replenish();
    audioScheduler.tick();
    const source = adapter.createdSources[0];
    engine.cancel();
    expect(source.isDisconnected).toBe(true);
    expect(source.stoppedAt).toBe(-1);
  });

  it('ignores stale events after cancellation and clears AudioScheduler queue', () => {
    engine.start(plan);
    mockTime = 9.0;
    engine.replenish();
    expect(audioScheduler.tick().scheduled.length).toBe(0);
    engine.cancel();
    mockTime = 10.0;
    engine.replenish();
    expect(audioScheduler.tick().scheduled.length).toBe(0);
    expect(adapter.createdSources.length).toBe(0);
  });

  it('removes active source when playback ends', () => {
    engine.start(plan);
    mockTime = 10.0;
    engine.replenish();
    audioScheduler.tick();
    const source = adapter.createdSources[0];
    source.onEndedCallback?.();
    engine.cancel();
    expect(source.stoppedAt).toBe(11.0);
  });

  it('evicts cache explicitly', () => {
    engine.start(plan);
    expect(adapter.createdBuffers.length).toBe(1);
    engine.evictCache('sess-1', 'take-1');
    engine.start(plan);
    expect(adapter.createdBuffers.length).toBe(2);
  });
});
