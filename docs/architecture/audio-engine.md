# Audio Engine Architecture v0.1

The Audio Engine package serves as the foundational boundary between the Web Audio API and the Precision Loop domain logic. 

## Responsibilities
- **AudioContext Lifecycle:** The engine completely owns an `AudioContext` and handles its lifecycle (initialization, suspend, resume, close).
- **Device Management:** Handles enumeration of inputs/outputs and listens for `devicechange` events to update consumers.
- **Root Graph:** Creates the minimal root graph (`AudioContext` -> `Master Gain` -> `Destination`).
- **AudioWorklet Infrastructure:** Proves worklet infrastructure through an optional, isolated initialization phase using a stable asset URL.
- **Scheduler Integration:** Provides an `AudioTimeSource` backed by `AudioContext.currentTime` for the Audio Scheduler.

## Strict Exclusions
- **No DSP or Effects:** Processing modules belong in downstream packages.
- **No Recording/Metronome:** Audio inputs and media stream acquisitions are excluded from the foundational engine logic.
- **No DOM/React:** Core logic uses minimal abstractions. Event target/listeners for device changes use simple callbacks, not `EventTarget` or React hooks.
- **No Timers:** The engine does not own intervals, timeouts, or recursive scheduling.

## Progressive Enhancement
The package relies on progressive enhancement for browser-specific capabilities:
- **Output selection (`setSinkId`):** Tested during operations. If unsupported, the engine falls back to default output safely.
- **Latency information:** Exposes `baseLatency` directly and `outputLatency` if available, otherwise returning `null`.
- **Latency Hint:** Configures context with `latencyHint: "interactive"` by default, treating it as a browser hint rather than a guarantee.
