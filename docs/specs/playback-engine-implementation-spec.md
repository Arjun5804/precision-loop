# Playback Engine Implementation Spec

## Overview
The `@precision-loop/playback-engine` package provides the deterministic audio runtime for playing domain `Loop`s.

## Inputs
- `PlaybackPlan`:
  - `originTime`: Absolute `AudioTime`.
  - `iterationDuration`: Pre-calculated absolute duration in seconds.
  - Track mixing state (volume, pan, mute, solo).
  - Domain `Take` object holding the PCM.

## Components
1. **Engine Facade:** Exposes `start()`, `replenish()`, `stop()`, `cancel()`, and implements `AudioEventSink`.
2. **HorizonScheduler:** Observes `replenish(currentTime)` calls, calculating a lookahead window `[currentTime, currentTime + horizon]`, queuing `LOOP_ITERATION(N)` events into the `AudioScheduler`.
3. **TrackMixer:** Resolves track state (Solo > Mute > Volume) and maintains Gain/StereoPanner nodes.
4. **BufferCache:** Manages `sessionId:takeId` -> `AudioBuffer` mappings.
5. **ResourceAdapter:** Isolates `AudioBuffer`, `AudioBufferSourceNode`, `GainNode`, and `StereoPannerNode` creation and connection behind an interface (`WebResourceAdapter` vs `FakeResourceAdapter`).

## Invariants to Test
- `iterationStart(N) === originTime + N * iterationDuration` for any `N`.
- Horizon scheduler pushes iterations up to the boundary and does not schedule duplicates.
- Late scheduler ticks do not alter the timestamp of future iterations.
- If an iteration's absolute start time is already in the past when replenishment occurs, it is NOT enqueued.
- If `originTime` < 0 or `iterationDuration` <= 0, `start()` throws an error.
- If `iterationDuration` does not match the Take's expected duration (`frameCount / sampleRate`) within a 0.001s tolerance, `start()` throws an error.
- Cancelled sessions actively remove any pending playback events from the `AudioScheduler`.
- Active source nodes are removed from internal tracking when they finish playing via an `onended` mechanism.
- Soloing a track forces the effective gain of all non-soloed tracks to 0.

## Error Handling
- Throw `InvalidPlaybackPlanError` for invalid parameters.
- If `AudioContext` is suspended, scheduling proceeds normally (as per Web Audio spec). Resume behavior is owned by the application.
