# Audio Scheduler Architecture

The Audio Scheduler bridges deterministic musical time and the physical audio layer.

## Responsibilities
- Event queuing and deterministic chronological ordering.
- Scheduling window evaluation via lookahead.
- Detecting and reporting late events.
- Preventing duplicate submissions of identical active events. Event IDs must be unique among currently pending events but may be reused once an event reaches a terminal state (cancelled, scheduled, or missed).
- Supporting cancellation of pending events.

## Non-Responsibilities
- **Web Audio**: The package is completely unaware of Web Audio nodes, `AudioContext`, or sample playback.
- **Timers**: The scheduler does not use `setInterval` or `setTimeout`. It is purely driven by its `tick()` method.
- **BPM/Musical Time**: Converting musical positions to absolute time is handled higher up (e.g., using `musical-clock`).
- **Late Event Rescheduling**: The scheduler does not try to "fix" late events; it simply reports them as missed.

## Tick Semantics
When `tick()` is called:
1. `currentTime` is retrieved from `AudioTimeSource`. It is strictly validated to ensure it is a finite, non-negative number.
2. A scheduling window is defined as `[currentTime, currentTime + lookahead]`.
3. All pending events with `time <= windowEnd` are popped.
4. If `time < currentTime`, it is placed in the `late` array.
5. If `time >= currentTime`, it is submitted to the `AudioEventSink` and placed in the `scheduled` array.

## Error Handling & Failures
- **Audio Time Source**: If the time source returns an invalid value (NaN, Infinity, or negative), the scheduler throws an `InvalidAudioTimeError` immediately and does not process events.
- **Sink Failures**: If `sink.schedule(event)` throws an error, the error propagates synchronously to the caller of `tick()`. The event is considered permanently consumed/terminal (the scheduler does not automatically retry it, nor does it swallow the error).

## Integration
A future `SchedulerDriver` package will be responsible for creating an interval (e.g., Worker loop) and calling `tick()` repeatedly.
