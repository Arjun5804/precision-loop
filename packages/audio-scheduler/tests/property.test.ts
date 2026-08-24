import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EventQueue } from '../src/event-queue.js';
import { ScheduledEvent } from '../src/types.js';
import { AudioScheduler } from '../src/scheduler.js';
import { FakeAudioTimeSource, TestAudioEventSink } from './fakes.js';

describe('Property Tests', () => {
  const eventArbitrary = fc.record({
    id: fc.uuid(),
    time: fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
    type: fc.constant('test'),
    payload: fc.constant(null)
  }) as fc.Arbitrary<ScheduledEvent>;

  it('always pops events in chronological order from EventQueue', () => {
    fc.assert(
      fc.property(fc.uniqueArray(eventArbitrary, { selector: v => v.id }), (events) => {
        const queue = new EventQueue();
        events.forEach(e => queue.add(e));
        
        let previousTime = -1;
        while (queue.pendingCount > 0) {
          const event = queue.pop()!;
          if (event.time < previousTime) return false;
          previousTime = event.time;
        }
        return true;
      })
    );
  });

  it('maintains scheduler invariants (window correctness, no duplicates)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(eventArbitrary, { selector: v => v.id }),
        fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }), // currentTime
        fc.float({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }), // lookahead
        (events, currentTime, lookahead) => {
          const timeSource = new FakeAudioTimeSource();
          const sink = new TestAudioEventSink();
          const scheduler = new AudioScheduler(timeSource, sink, { lookahead });
          
          scheduler.start();
          timeSource.setCurrentTime(currentTime);

          events.forEach(e => scheduler.schedule(e));
          
          const windowEnd = currentTime + lookahead;
          const result = scheduler.tick();

          // 1. All scheduled events are within [currentTime, windowEnd]
          for (const ev of result.scheduled) {
            if (ev.time < currentTime || ev.time > windowEnd) {
              return false;
            }
          }

          // 2. All late events are strictly < currentTime
          for (const ev of result.late) {
            if (ev.time >= currentTime) {
              return false;
            }
          }

          // 3. No duplicate ID output in sink
          const scheduledIds = new Set(sink.scheduledEvents.map(e => e.id));
          if (scheduledIds.size !== sink.scheduledEvents.length) {
            return false;
          }

          return true;
        }
      )
    );
  });
});
