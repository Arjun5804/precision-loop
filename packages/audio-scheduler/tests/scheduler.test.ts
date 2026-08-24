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

  it('allows scheduling the same ID again after submission', () => {
    scheduler.schedule(createEvent('1', 10.000));
    timeSource.setCurrentTime(10.000);
    scheduler.tick();
    
    scheduler.schedule(createEvent('1', 10.050));
    expect(scheduler.cancel('1')).toBe(true);
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
});
