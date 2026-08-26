import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaybackEngine } from '../src/engine';
import { FakeResourceAdapter, FakeSourceNodeWrapper } from '../src/fake-resource-adapter';
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

    // Make engine an event sink for the scheduler
    // Transport or some coordinator usually wires this up. For tests we can mock the scheduler's sink.
    const originalTick = audioScheduler.tick.bind(audioScheduler);
    audioScheduler.tick = () => {
      const res = originalTick();
      for (const ev of res.scheduled) {
        engine.schedule(ev);
      }
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
          trackId: 'track-1',
          take: dummyTake,
          iterationDuration: 1.0,
          volume: 1.0,
          pan: 0,
          muted: false,
          soloed: false
        }
      ]
    };
  });

  it('rejects invalid plan with mismatched iterationDuration', () => {
    // dummyTake has 48000 frames at 48000Hz = 1.0s.
    plan.tracks[0].iterationDuration = 1.5;
    expect(() => engine.start(plan)).toThrow(InvalidPlaybackPlanError);
  });

  it('accepts valid plan with small floating-point difference in duration', () => {
    plan.tracks[0].iterationDuration = 1.0 + 0.0005; // Within 0.001
    expect(() => engine.start(plan)).not.toThrow();
  });

  it('rejects invalid plan', () => {
    plan.originTime = -1;
    expect(() => engine.start(plan)).toThrow(InvalidPlaybackPlanError);
  });

  it('starts playback and schedules nodes upon tick', () => {
    engine.start(plan);
    
    // Fast forward to 10.0
    mockTime = 10.0;
    engine.replenish();
    audioScheduler.tick();
    
    // Should have created one buffer (cached) and one source node for N=0
    expect(adapter.createdBuffers.length).toBe(1);
    expect(adapter.createdSources.length).toBe(1);
    
    const source = adapter.createdSources[0];
    expect(source.startedAt).toBe(10.0);
    expect(source.stoppedAt).toBe(11.0);
  });

  it('cancels playback and stops active nodes immediately', () => {
    engine.start(plan);
    mockTime = 10.0;
    engine.replenish();
    audioScheduler.tick(); // Triggers start
    
    const source = adapter.createdSources[0];
    
    engine.cancel();
    
    expect(source.isDisconnected).toBe(true);
    expect(source.stoppedAt).toBe(-1); // Stop called without 'when'
  });

  it('ignores stale events after cancellation and clears AudioScheduler queue', () => {
    engine.start(plan);
    mockTime = 9.0;
    engine.replenish(); // schedules N=0 at 10.0
    
    // There should be events in AudioScheduler
    expect(audioScheduler.tick().scheduled.length).toBe(0); // Tick doesn't pop because time is 9.0, but they are in the queue.
    
    engine.cancel();
    
    // The events should have been removed from the queue
    mockTime = 10.0;
    engine.replenish();
    const tickRes = audioScheduler.tick();
    
    // N=0 should not be in the queue anymore (was cancelled)
    // Actually, calling engine.replenish() after cancel() does nothing because activePlan is null.
    // So no new events are added, and the old ones were cancelled.
    expect(tickRes.scheduled.length).toBe(0); 
    
    expect(adapter.createdSources.length).toBe(0); // No nodes created
  });

  it('removes active source when playback ends', () => {
    engine.start(plan);
    mockTime = 10.0;
    engine.replenish();
    audioScheduler.tick();
    
    const source = adapter.createdSources[0];
    
    // Simulate node ending
    source.onEndedCallback?.();
    
    engine.cancel();
    
    // Stop shouldn't be called again because it was removed
    // Stop was already called at creation time with a 'when' parameter: source.stop(startTime + payload.duration).
    // So stoppedAt should be 11.0, NOT -1.
    expect(source.stoppedAt).toBe(11.0); 
  });

  it('evicts cache explicitly', () => {
    engine.start(plan);
    expect(adapter.createdBuffers.length).toBe(1);
    
    engine.evictCache('sess-1', 'take-1');
    
    // Start again, it should recreate the buffer
    engine.start(plan);
    expect(adapter.createdBuffers.length).toBe(2);
  });
});
