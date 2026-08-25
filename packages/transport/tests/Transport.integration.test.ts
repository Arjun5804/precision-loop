import { describe, it, expect, beforeEach } from 'vitest';
import { Transport } from '../src/Transport';
import { MusicalClock } from '@precision-loop/musical-clock';
import { AudioScheduler } from '@precision-loop/audio-scheduler';
import { FakeAudioTimeSource, FakeAudioEventSink, FakeRecordingEngine } from './fakes';

describe('Transport Integration with Real Dependencies', () => {
  let timeSource: FakeAudioTimeSource;
  let sink: FakeAudioEventSink;
  let scheduler: AudioScheduler;
  let clock: MusicalClock;
  let recordingEngine: FakeRecordingEngine;
  let transport: Transport;

  beforeEach(() => {
    timeSource = new FakeAudioTimeSource();
    sink = new FakeAudioEventSink();
    scheduler = new AudioScheduler(timeSource, sink, { lookahead: 0.1 });
    clock = new MusicalClock(120, { numerator: 4, denominator: 4 }, { subdivisionsPerBeat: 4 });
    recordingEngine = new FakeRecordingEngine() as any;
    
    transport = new Transport(clock, scheduler, recordingEngine as any);
  });

  it('orchestrates end to end seamlessly', async () => {
    transport.configure({
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      countInBars: 1,
      recordingBars: 2,
    });

    const startPromise = transport.start(10.0, 'worklet-url.js');

    // Transport transitions to ARMING and prepares recording engine
    await Promise.resolve(); // prepare
    expect(recordingEngine.preparedUrl).toBe('worklet-url.js');

    // Transport transitions to ACTIVE and arms
    await Promise.resolve();
    expect(transport.getState()).toBe('ACTIVE');

    // Validate the exact recording window (1 bar @ 120bpm = 2s)
    expect(recordingEngine.armedWindow).toEqual({
      startTime: 12.0, // 10.0 + 2s
      endTime: 16.0,   // 12.0 + 4s (2 bars recording)
    });

    // Run scheduler ticks to verify integration with AudioScheduler
    scheduler.start();
    
    // At t=0, nothing is scheduled because events are at t >= 10
    timeSource.time = 0;
    scheduler.tick();
    expect(sink.events.length).toBe(0);

    // At t=9.9, events at 10.0 and 10.5 are in the lookahead (10.0) window
    timeSource.time = 9.9;
    scheduler.tick();
    expect(sink.events.length).toBe(1); // Only beat 0 (10.0) is in lookahead (9.9 + 0.1 = 10.0)
    // Regression check: Transport state should NOT transition just because of sink submission
    expect(transport.getState()).toBe('ACTIVE');

    timeSource.time = 10.4;
    scheduler.tick();
    expect(sink.events.length).toBe(2); // Beat 1 (10.5) is now in lookahead (10.4 + 0.1 = 10.5)
    // Regression check: Transport state should STILL be ACTIVE
    expect(transport.getState()).toBe('ACTIVE');

    // Complete the recording
    recordingEngine.simulateCompletion('final-take-abc');
    await startPromise;

    expect(transport.getState()).toBe('COMPLETED');
  });
});
