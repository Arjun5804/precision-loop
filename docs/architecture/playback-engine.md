# Playback Engine Architecture v0.1

The `@precision-loop/playback-engine` is responsible for translating audio-domain configuration into deterministic Web Audio playback.

## Responsibilities
- **AudioBuffer Management:** Caches and reuses Web Audio representations of domain `Take` objects.
- **Audio Graph Maintenance:** Creates and updates Track subgraphs (Gain, Pan) and connects them to the `AudioEngine` master graph.
- **Drift-Free Scheduling:** Schedules exact loop repetitions anchored to an absolute `AudioTime` origin.
- **Playback Lifecycle:** Owns the start, stop, and cancellation logic for its internal playback nodes and scheduled events.

## Non-Responsibilities
- **Musical Time:** It does not understand BPM, bars, or beats. The orchestrating layer provides it with exact `AudioTime` durations.
- **AudioContext Lifecycle:** It does not create, resume, or suspend the `AudioContext`.
- **Runtime Ticking:** It does not own the setInterval/requestAnimationFrame loop. It observes external ticks to maintain its scheduling horizon.
- **PCM Mutation:** It does not mutate or resample the source `Take` PCM data.

## Architectural Boundaries

1. **PlaybackPlan:** The engine consumes a `PlaybackPlan` containing absolute `AudioTime` parameters. This isolates the engine from the complexity of musical time calculations.
2. **Horizon Scheduling:** The engine uses a bounded lookahead horizon to pre-emptively schedule future iterations into the `AudioScheduler`. The mathematical invariant `iterationStart(N) = originTime + N * iterationDuration` guarantees zero cumulative drift, independent of when the scheduler actually ticks.
3. **AudioEngine Integration:** The engine connects its Track outputs strictly via the `AudioEngine.connectToMaster()` public API, avoiding internal graph mutations.
4. **Adapter Pattern:** Web Audio DOM objects are hidden behind a `PlaybackResourceAdapter`, allowing the core logic and scheduling math to be tested deterministically in Node.js.
