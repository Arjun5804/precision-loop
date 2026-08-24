import { describe, it, expect, beforeEach } from 'vitest';
import { EventQueue } from '../src/event-queue.js';
import { DuplicateEventIdError } from '../src/errors.js';
import { ScheduledEvent } from '../src/types.js';

describe('EventQueue', () => {
  let queue: EventQueue;

  beforeEach(() => {
    queue = new EventQueue();
  });

  const createEvent = (id: string, time: number): ScheduledEvent => ({
    id,
    time,
    type: 'test',
    payload: null
  });

  it('adds events and maintains chronological order', () => {
    queue.add(createEvent('2', 2.0));
    queue.add(createEvent('1', 1.0));
    queue.add(createEvent('3', 3.0));

    expect(queue.pop()?.id).toBe('1');
    expect(queue.pop()?.id).toBe('2');
    expect(queue.pop()?.id).toBe('3');
  });

  it('maintains insertion order for equal timestamps', () => {
    queue.add(createEvent('A', 1.0));
    queue.add(createEvent('B', 1.0));

    expect(queue.pop()?.id).toBe('A');
    expect(queue.pop()?.id).toBe('B');
  });

  it('prevents adding duplicate event IDs', () => {
    queue.add(createEvent('1', 1.0));
    expect(() => queue.add(createEvent('1', 2.0))).toThrow(DuplicateEventIdError);
  });

  it('removes events by ID', () => {
    queue.add(createEvent('1', 1.0));
    const removed = queue.remove('1');
    expect(removed).toBe(true);
    expect(queue.peek()).toBeUndefined();
  });

  it('returns false when removing non-existent event', () => {
    expect(queue.remove('missing')).toBe(false);
  });

  it('clears all events', () => {
    queue.add(createEvent('1', 1.0));
    queue.removeAll();
    expect(queue.pendingCount).toBe(0);
    expect(queue.peek()).toBeUndefined();
  });
  
  it('correctly reports pendingCount', () => {
    expect(queue.pendingCount).toBe(0);
    queue.add(createEvent('1', 1.0));
    expect(queue.pendingCount).toBe(1);
    queue.pop();
    expect(queue.pendingCount).toBe(0);
  });
});
