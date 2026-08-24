import { describe, it, expect, beforeEach } from 'vitest';
import { AudioScheduler } from '../src/scheduler.js';
import { FakeAudioTimeSource, TestAudioEventSink } from './fakes.js';
import { SchedulerState, ScheduledEvent } from '../src/types.js';
import { DuplicateEventIdError, InvalidLookaheadError, InvalidAudioTimeError, InvalidEventError } from '../src/errors.js';

describe('AudioScheduler', () => {
  let timeSource: FakeAudioTimeSource;
  let sink: TestAudioEventSink;
  let scheduler: AudioScheduler;

  beforeEach(() => {
    timeSource = new FakeAudioTimeSource();
    sink = new TestAudioEventSink();
    scheduler = new AudioScheduler(timeSource, sink, { lookahead: 0.1 });
    scheduler.start();
  });

  const createEvent = (id: string, time: number): ScheduledEvent => ({
    id,
    time,
    type: 'test',
    payload: null
  });

  it('initializes with default state', () => {
    const s = new AudioScheduler(timeSource, sink);
    expect(s.currentState).toBe(SchedulerState.STOPPED);
  });

  it('validates config lookahead', () => {
    expect(() => new AudioScheduler(timeSource, sink, { lookahead: -1 })).toThrow(InvalidLookaheadError);
  });

  it('schedules events within lookahead window', () => {
    timeSource.setCurrentTime(10.000);
    
    scheduler.schedule(createEvent('1', 9.999)); // late
    scheduler.schedule(createEvent('2', 10.000));
    scheduler.schedule(createEvent('3', 10.050));
    scheduler.schedule(createEvent('4', 10.100)); // exactly at window end
    scheduler.schedule(createEvent('5', 10.101)); // outside window

    const result = scheduler.tick();

    expect(result.currentTime).toBe(10.000);
    expect(result.windowEnd).toBe(10.100);
    
    expect(result.scheduled.map(e => e.id)).toEqual(['2', '3', '4']);
    expect(result.late.map(e => e.id)).toEqual(['1']);
    
    expect(sink.scheduledEvents.map(e => e.id)).toEqual(['2', '3', '4']);
    
    // Check remaining events on next tick
    timeSource.setCurrentTime(10.100);
    const result2 = scheduler.tick();
    expect(result2.scheduled.map(e => e.id)).toEqual(['5']);
  });

  it('does not schedule when STOPPED', () => {
    scheduler.stop();
    scheduler.schedule(createEvent('1', 10.000));
    timeSource.setCurrentTime(10.000);
    
    const result = scheduler.tick();
    expect(result.scheduled).toHaveLength(0);
    expect(sink.scheduledEvents).toHaveLength(0);
  });

  it('allows ID reuse after cancellation, late, or scheduled states', () => {
    // 1. reuse after cancel
    scheduler.schedule(createEvent('reuse-id', 10.000));
    scheduler.cancel('reuse-id');
    expect(() => scheduler.schedule(createEvent('reuse-id', 10.100))).not.toThrow();
    
    // 2. reuse after cancelAll
    scheduler.cancelAll();
    expect(() => scheduler.schedule(createEvent('reuse-id', 10.200))).not.toThrow();
    
    // 3. reuse after scheduled
    timeSource.setCurrentTime(10.200);
    scheduler.tick(); // schedules 'reuse-id'
    expect(() => scheduler.schedule(createEvent('reuse-id', 10.300))).not.toThrow();
    
    // 4. reuse after late
    timeSource.setCurrentTime(10.400); // 10.300 is late now
    scheduler.tick(); // pops 'reuse-id' as late
    expect(() => scheduler.schedule(createEvent('reuse-id', 10.500))).not.toThrow();
  });

  it('validates event properties', () => {
    expect(() => scheduler.schedule(createEvent('1', -1))).toThrow(InvalidAudioTimeError);
    expect(() => scheduler.schedule({ id: '', time: 1.0, type: 'x', payload: null })).toThrow(InvalidEventError);
  });

  it('does not reschedule late events (regression)', () => {
    const s = new AudioScheduler(timeSource, sink, { lookahead: 0.025 });
    s.start();
    
    s.schedule(createEvent('late-evt', 10.050));
    
    // tick at 10.000 -> remains pending
    timeSource.setCurrentTime(10.000);
    const result1 = s.tick();
    expect(result1.scheduled).toHaveLength(0);
    expect(result1.late).toHaveLength(0);
    
    // tick at 10.100 -> late/missed, NOT rescheduled
    timeSource.setCurrentTime(10.100);
    const result2 = s.tick();
    expect(result2.late.map(e => e.id)).toEqual(['late-evt']);
    expect(result2.scheduled).toHaveLength(0);
    expect(sink.scheduledEvents).toHaveLength(0);
  });

  it('processes pending events after start() but not while STOPPED', () => {
    scheduler.stop();
    scheduler.schedule(createEvent('stop-evt', 10.000));
    timeSource.setCurrentTime(10.000);
    
    // tick while STOPPED -> not submitted
    const result1 = scheduler.tick();
    expect(result1.scheduled).toHaveLength(0);
    expect(sink.scheduledEvents).toHaveLength(0);
    
    // tick after start() -> processed
    scheduler.start();
    const result2 = scheduler.tick();
    expect(result2.scheduled.map(e => e.id)).toEqual(['stop-evt']);
    expect(sink.scheduledEvents.map(e => e.id)).toEqual(['stop-evt']);
  });

  it('supports cancellation before scheduling', () => {
    scheduler.schedule(createEvent('1', 10.050));
    const cancelled = scheduler.cancel('1');
    expect(cancelled).toBe(true);
    
    timeSource.setCurrentTime(10.050);
    scheduler.tick();
    expect(sink.scheduledEvents).toHaveLength(0);
  });

  it('cancellation after scheduling does not unschedule from sink', () => {
    scheduler.schedule(createEvent('1', 10.000));
    timeSource.setCurrentTime(10.000);
    scheduler.tick();
    
    const cancelled = scheduler.cancel('1');
    expect(cancelled).toBe(false); // No longer pending
    expect(sink.scheduledEvents.map(e => e.id)).toEqual(['1']);
  });

  it('validates AudioTimeSource.currentTime() inside tick()', () => {
    scheduler.start();
    
    timeSource.setCurrentTime(-1);
    expect(() => scheduler.tick()).toThrow(InvalidAudioTimeError);
    
    timeSource.setCurrentTime(NaN);
    expect(() => scheduler.tick()).toThrow(InvalidAudioTimeError);
    
    timeSource.setCurrentTime(Infinity);
    expect(() => scheduler.tick()).toThrow(InvalidAudioTimeError);
  });

  it('propagates sink errors and does not retry the event', () => {
    scheduler.start();
    scheduler.schedule(createEvent('fail-event', 10.000));
    timeSource.setCurrentTime(10.000);
    
    // Make sink throw
    sink.schedule = () => { throw new Error('Sink failure'); };
    
    expect(() => scheduler.tick()).toThrow('Sink failure');
    
    // Restore sink and check queue is empty of the failed event
    sink.schedule = (e) => sink.scheduledEvents.push(e);
    const result = scheduler.tick();
    expect(result.scheduled).toHaveLength(0);
    expect(result.late).toHaveLength(0);

    // The event is permanently consumed/terminal, so we can reuse the ID
    expect(() => scheduler.schedule(createEvent('fail-event', 10.100))).not.toThrow();
  });
});
