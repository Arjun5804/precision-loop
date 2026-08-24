# @precision-loop/audio-scheduler

The Audio Scheduler is a pure domain package for Precision Loop responsible for determining which musical/audio events should be submitted to an audio timeline during a scheduling tick.

## Architecture

This package is completely decoupled from Web Audio, the DOM, and timers.
It implements a manually-driven `tick()` method which processes an internal priority queue of scheduled events against a provided `AudioTimeSource`.

## Quick Example

```typescript
import { AudioScheduler, ScheduledEvent } from '@precision-loop/audio-scheduler';

const timeSource = { currentTime: () => 10.000 };
const sink = { schedule: (e) => console.log('Scheduled', e) };

const scheduler = new AudioScheduler(timeSource, sink, { lookahead: 0.1 });
scheduler.start();

scheduler.schedule({
  id: 'evt-1',
  time: 10.050,
  type: 'note',
  payload: null
});

// Drive the scheduler manually (usually done by a Scheduler Driver in an interval/worker)
const result = scheduler.tick();
// Submits 'evt-1' to sink because 10.050 is within [10.000, 10.100]
```
