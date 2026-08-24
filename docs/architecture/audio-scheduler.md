# Audio Scheduler Architecture

The Audio Scheduler bridges deterministic musical time and the physical audio layer.

## Responsibilities
- Event queuing and deterministic chronological ordering.
- Scheduling window evaluation via lookahead.
- Detecting and reporting late events.
- Preventing duplicate submissions of identical events.
- Supporting cancellation of pending events.

## Non-Responsibilities
- **Web Audio**: The package is completely unaware of Web Audio nodes, `AudioContext`, or sample playback.
- **Timers**: The scheduler does not use `setInterval` or `setTimeout`. It is purely driven by its `tick()` method.
- **BPM/Musical Time**: Converting musical positions to absolute time is handled higher up (e.g., using `musical-clock`).
- **Late Event Rescheduling**: The scheduler does not try to "fix" late events; it simply reports them as missed.

## Tick Semantics
When `tick()` is called:
1. `currentTime` is retrieved from `AudioTimeSource`.
2. A scheduling window is defined as `[currentTime, currentTime + lookahead]`.
3. All pending events with `time <= windowEnd` are popped.
4. If `time < currentTime`, it is placed in the `late` array.
5. If `time >= currentTime`, it is submitted to the `AudioEventSink` and placed in the `scheduled` array.

## Integration
A future `SchedulerDriver` package will be responsible for creating an interval (e.g., Worker loop) and calling `tick()` repeatedly.
