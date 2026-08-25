# Web Audio Runtime Boundary

**Date:** 2026-08-25
**Status:** Accepted

## Context

Precision Loop requires highly accurate timing, deterministic testing, and eventually complex audio recording, processing, and playback.
The Web Audio API (specifically `AudioContext`, `MediaDevices`, and `AudioWorklet`) is extremely powerful, but tying domain logic directly to these browser APIs makes logic difficult to test and tightly couples business logic to browser-specific lifecycle quirks (such as suspended contexts, latency variations, and permission handling).

## Decision

We will isolate all direct Web Audio API interaction behind an `AudioEngine` package (`@precision-loop/audio-engine`).

## Consequences

1. **Testability:** Core domain logic (like scheduling and timing) can be tested deterministically in Node by mocking the narrow boundaries of the `AudioEngine`.
2. **Lifecycle Control:** The engine strictly owns the `AudioContext` lifecycle. Initialization is explicit, avoiding unexpected browser autoplay policy violations.
3. **No Direct DOM access in core:** We prevent browser-specific objects (`AudioContext`, `AudioNode`, `MediaDeviceInfo`) from leaking into the scheduler, musical clock, or React UI components.
4. **Focused Responsibilities:** The audio engine strictly handles infrastructure: device enumeration, context lifecycle, root graph creation, and worklet loading. It does not mix tracks or provide UI logic.
