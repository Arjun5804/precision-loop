# ADR 007: Playback Engine Runtime Boundary

## Context
Precision Loop requires a mechanism to play back recorded loops with sample-accurate repetition. The playback must handle multiple tracks, volume/pan/mute/solo mixing, and infinite looping without timing drift. Because loop boundaries are determined by musical time, the scheduling mechanism must remain perfectly synced to the absolute audio timeline, independent of main-thread execution delays.

## Decisions

1. **No Musical Interpretation:** The Playback Engine will not calculate durations from BPM or Time Signatures. It will consume a `PlaybackPlan` containing pre-resolved exact `AudioTime` durations.
2. **One AudioBufferSourceNode per Iteration:** We will instantiate a new `AudioBufferSourceNode` for every single loop iteration rather than using native `.loop = true`. This ensures iterations are independently schedulable, cancellable, and trackable as explicit application events, providing metadata for synchronization with future click tracks or UI playheads.
3. **Absolute-Origin Horizon Scheduling:** The start time of iteration `N` is calculated strictly as `originTime + N * iterationDuration`. Future iterations are pre-emptively pushed into the `AudioScheduler` within a bounded lookahead horizon (e.g., 2 seconds). This decouples the calculation of `N` from the actual delivery time of `N-1`.
4. **Buffer Cache & Reuse:** `AudioBuffer`s are cached using a globally unique `sessionId:takeId` key. The buffers are reused across all iterations, preventing memory explosions and avoiding unnecessary PCM copies.
5. **Stable AudioEngine Boundary:** The Playback Engine will connect its output to the master graph via a clean `connectToMaster` method added to the `AudioEngine`, avoiding coupling to internal graph structures.
6. **Cancellation Ownership:** The Playback Engine owns its own cancellation via `cancel()`. The orchestrating layer invokes this directly rather than trying to clean up Playback Engine internals. Cancellation actively clears pending session events from the `AudioScheduler`, and source nodes track their own lifecycle via `onended` callbacks to prevent unbounded memory growth.

## Consequences
- **Positive:** Zero cumulative timing drift. Clean separation of musical time and audio time. The engine is highly testable in Node.js via the adapter pattern. 
- **Negative:** Increased event volume for very short loops, as each iteration is a distinct scheduled event and requires a new source node. Memory must be explicitly managed by evicting stale buffers from the cache.
