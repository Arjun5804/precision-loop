import { describe, it, expect, beforeEach } from 'vitest';
import { HorizonScheduler } from '../src/horizon-scheduler';
import { AudioScheduler, AudioTimeSource, createAudioTimeSource, ScheduledEvent } from '@precision-loop/audio-scheduler';
import { PlaybackPlan } from '../src/playback-plan';
import { Take } from '@precision-loop/loop-model';

describe('HorizonScheduler', () => {
  let audioScheduler: AudioScheduler;
  let timeSource: AudioTimeSource;
  let horizonScheduler: HorizonScheduler;
  let plan: PlaybackPlan;
  let mockTime = 0;

  beforeEach(() => {
    mockTime = 0;
    timeSource = { currentTime: () => mockTime };
    const dummySink = { schedule: () => {} };
    audioScheduler = new AudioScheduler(timeSource, dummySink, { lookahead: 0.1 });
    audioScheduler.start();
    horizonScheduler = new HorizonScheduler(audioScheduler, 2.0); // 2.0s horizon

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
      originTime: 100.0,
      tracks: [
        {
          trackId: 'track-1',
          take: dummyTake,
          iterationDuration: 2.0, // exactly 2 seconds
          volume: 1.0,
          pan: 0,
          muted: false,
          soloed: false
        }
      ]
    };
  });

  it('schedules initial iterations correctly based on absolute origin', () => {
    // Current time is 99.0, horizon is 2.0s -> windowEnd is 101.0
    // Origin is 100.0. N=0 starts at 100.0 (in window). N=1 starts at 102.0 (out of window).
    horizonScheduler.replenish(plan, 99.0);
    
    // Simulate tick to pop scheduled events
    // Wait, audioScheduler.tick() will pop if windowEnd >= eventTime
    // tick lookahead is 0.1s, current time 99.0, window is [99.0, 99.1].
    // event at 100.0 won't be popped yet.
    
    // We can inspect the internal queue by using a trick or mocking AudioScheduler if needed.
    // Or we advance time to 100.0 and tick.
    const result1 = audioScheduler.tick(); 
    expect(result1.scheduled.length).toBe(0);

    // Advance time to 100.0
    mockTime = 100.0;
    const result2 = audioScheduler.tick();
    
    expect(result2.scheduled.length).toBe(1);
    expect(result2.scheduled[0].time).toBe(100.0);
    expect((result2.scheduled[0].payload as any).iterationIndex).toBe(0);
  });

  it('replenishes iterations correctly as time moves forward without duplicate scheduling', () => {
    // Start at 99.0
    horizonScheduler.replenish(plan, 99.0);
    
    // Move to 101.0. Window ends at 103.0. Should schedule N=1 (102.0).
    horizonScheduler.replenish(plan, 101.0);
    
    mockTime = 102.0;
    
    const result = audioScheduler.tick();
    
    expect(result.scheduled.length).toBe(1); // N=1
    expect(result.scheduled[0].time).toBe(102.0);
    expect((result.scheduled[0].payload as any).iterationIndex).toBe(1);
  });

  it('maintains absolute times for N=500 without cumulative drift', () => {
    // N=500 starts at 100.0 + 500 * 2.0 = 1100.0
    horizonScheduler.replenish(plan, 1099.0);
    
    mockTime = 1100.0;
    
    const result = audioScheduler.tick();
    expect(result.scheduled.length).toBeGreaterThan(0);
    const event = result.scheduled.find(e => (e.payload as any).iterationIndex === 500);
    expect(event).toBeDefined();
    expect(event!.time).toBe(1100.0);
  });

  it('skips late iterations without scheduling them', () => {
    // Current time is 101.5. 
    // Origin is 100. N=0 (100.0) is late. N=1 (102.0) is in the future.
    // It should schedule N=1, but NOT N=0.
    horizonScheduler.replenish(plan, 101.5);
    
    mockTime = 102.0;
    const result = audioScheduler.tick();
    
    expect(result.scheduled.length).toBe(1);
    expect((result.scheduled[0].payload as any).iterationIndex).toBe(1);
    expect(result.scheduled[0].time).toBe(102.0);
  });
});
