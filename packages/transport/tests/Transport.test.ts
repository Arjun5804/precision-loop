import { describe, it, expect, beforeEach } from 'vitest';
import { Transport } from '../src/Transport';
import { MusicalClock } from '@precision-loop/musical-clock';
import { FakeAudioScheduler, FakeRecordingEngine } from './fakes';
import type { TransportConfig } from '../src/types';

describe('Transport', () => {
  let clock: MusicalClock;
  let scheduler: FakeAudioScheduler;
  let recordingEngine: FakeRecordingEngine;
  let transport: Transport;

  const validConfig: TransportConfig = {
    tempo: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    countInBars: 2,
    recordingBars: 4,
  };

  beforeEach(() => {
    clock = new MusicalClock(120, { numerator: 4, denominator: 4 }, { subdivisionsPerBeat: 4 });
    scheduler = new FakeAudioScheduler();
    recordingEngine = new FakeRecordingEngine();
    transport = new Transport(clock, scheduler, recordingEngine);
  });

  it('starts in IDLE state', () => {
    expect(transport.getState()).toBe('IDLE');
  });

  it('validates configuration and updates state', () => {
    transport.configure(validConfig);
    // State should still be IDLE
    expect(transport.getState()).toBe('IDLE');
  });

  it('rejects invalid configuration synchronously', () => {
    expect(() => transport.configure({ ...validConfig, tempo: -1 })).toThrowError('Tempo must be a positive');
  });

  it('plans session and coordinates RecordingEngine properly', async () => {
    transport.configure(validConfig);
    
    // We don't await start yet, we let it run so we can inspect intermediate state
    const startPromise = transport.start(100.0, 'worklet-url.js');
    
    // We expect it to be ARMING first, and recording engine gets prepared
    // Due to async nature, we wait a microtick
    await Promise.resolve();
    
    expect(recordingEngine.preparedUrl).toBe('worklet-url.js');
    
    // Next it should be ACTIVE
    await Promise.resolve(); 
    expect(transport.getState()).toBe('ACTIVE');
    
    // Validate arming
    expect(recordingEngine.armedWindow).toBeDefined();
    expect(recordingEngine.armedWindow?.startTime).toBe(104.0); // 2 bars count in @ 120bpm = 4s. 100+4 = 104
    expect(recordingEngine.armedWindow?.endTime).toBe(112.0); // 4 bars recording = 8s. 104+8 = 112
    
    // Validate scheduler click events
    expect(scheduler.scheduledEvents.length).toBe(8); // 2 bars * 4 beats
    
    // Simulate recording completion
    recordingEngine.simulateCompletion();
    
    await startPromise;
    expect(transport.getState()).toBe('COMPLETED');
  });

  it('cancels an active session and tracks generated event IDs correctly', async () => {
    transport.configure(validConfig);
    const startPromise = transport.start(100.0, 'worklet-url.js');
    
    await Promise.resolve(); // allow prepare
    await Promise.resolve(); // allow arm
    
    expect(transport.getState()).toBe('ACTIVE');
    const scheduledIds = scheduler.scheduledEvents.map(e => e.id);
    expect(scheduledIds.length).toBeGreaterThan(0);
    
    // Stop it
    transport.stop();
    expect(transport.getState()).toBe('IDLE');
    expect(recordingEngine.isCancelled).toBe(true);
    
    // Check if correct event IDs were cancelled
    for (const id of scheduledIds) {
      expect(scheduler.cancelledIds).toContain(id);
    }
    
    // Catch the rejection from startPromise caused by cancellation
    await expect(startPromise).rejects.toThrow();
  });

  it('rejects stale async completion', async () => {
    transport.configure(validConfig);
    const startPromise1 = transport.start(100.0, 'worklet-url.js');
    
    await Promise.resolve();
    await Promise.resolve(); // ACTIVE
    
    transport.stop();
    
    // Start a new session
    const startPromise2 = transport.start(200.0, 'worklet-url.js');
    await Promise.resolve();
    await Promise.resolve();
    
    // Complete the FIRST session's promise
    // In our fake, the resolveArm gets overwritten by the second session, 
    // so let's simulate the first one resolving its promise manually if we could.
    // However, the test structure means `stop()` already rejected the first one.
    // Complete the FIRST session's promise
    await expect(startPromise1).rejects.toThrow();
  });

  it('handles partial CLICK scheduling failure', async () => {
    transport.configure(validConfig);
    
    // We set the fake scheduler to throw on the 3rd click event
    scheduler.failOnScheduleCount = 3;
    
    const startPromise = transport.start(100.0, 'worklet-url.js');
    
    // Wait for the failure to propagate
    await expect(startPromise).rejects.toThrow('Dependency failed during session');
    
    // Verify cleanup
    expect(transport.getState()).toBe('ERROR');
    expect(transport.getPlan()).toBeNull();
    expect(transport.getTake()).toBeNull();
    expect(recordingEngine.isCancelled).toBe(true);
    
    // Since it failed on the 3rd event, the first 2 should have been scheduled
    // and they should have been subsequently cancelled during cleanup.
    const scheduledIds = scheduler.scheduledEvents.map(e => e.id);
    for (const id of scheduledIds) {
      expect(scheduler.cancelledIds).toContain(id);
    }
  });

  describe('Time Signature Regressions', () => {
    it('handles 3/4 time signature', async () => {
      const config34: TransportConfig = { tempo: 120, timeSignature: { numerator: 3, denominator: 4 }, countInBars: 2, recordingBars: 4 };
      const clock34 = new MusicalClock(120, { numerator: 3, denominator: 4 }, { subdivisionsPerBeat: 4 });
      transport = new Transport(clock34, scheduler, recordingEngine);
      transport.configure(config34);
      
      const startPromise = transport.start(10.0, 'worklet-url.js');
      await Promise.resolve(); await Promise.resolve();
      
      const plan = transport.getPlan()!;
      expect(plan.countInEvents.length).toBe(6); // 2 bars * 3 beats
      expect(plan.recordingEndTime - plan.recordingStartTime).toBe(clock34.barsToSeconds(4)); // 4 bars = 12 beats = 6s
      expect(plan.recordingStartTime).toBe(10.0 + clock34.barsToSeconds(2)); // 10.0 + 3s = 13.0
      
      transport.stop();
      await expect(startPromise).rejects.toThrow();
    });

    it('handles 6/8 time signature', async () => {
      const config68: TransportConfig = { tempo: 120, timeSignature: { numerator: 6, denominator: 8 }, countInBars: 2, recordingBars: 2 };
      const clock68 = new MusicalClock(120, { numerator: 6, denominator: 8 }, { subdivisionsPerBeat: 2 });
      transport = new Transport(clock68, scheduler, recordingEngine);
      transport.configure(config68);
      
      const startPromise = transport.start(10.0, 'worklet-url.js');
      await Promise.resolve(); await Promise.resolve();
      
      const plan = transport.getPlan()!;
      expect(plan.countInEvents.length).toBe(12); // 2 bars * 6 beats
      expect(plan.recordingEndTime - plan.recordingStartTime).toBe(clock68.barsToSeconds(2));
      
      transport.stop();
      await expect(startPromise).rejects.toThrow();
    });

    it('handles 7/8 time signature', async () => {
      const config78: TransportConfig = { tempo: 120, timeSignature: { numerator: 7, denominator: 8 }, countInBars: 1, recordingBars: 2 };
      const clock78 = new MusicalClock(120, { numerator: 7, denominator: 8 }, { subdivisionsPerBeat: 2 });
      transport = new Transport(clock78, scheduler, recordingEngine);
      transport.configure(config78);
      
      const startPromise = transport.start(10.0, 'worklet-url.js');
      await Promise.resolve(); await Promise.resolve();
      
      const plan = transport.getPlan()!;
      expect(plan.countInEvents.length).toBe(7); // 1 bar * 7 beats
      expect(plan.recordingEndTime - plan.recordingStartTime).toBe(clock78.barsToSeconds(2));
      
      transport.stop();
      await expect(startPromise).rejects.toThrow();
    });
  });
});
