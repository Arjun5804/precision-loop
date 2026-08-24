# ADR 002: Audio Scheduler Separation

**Date**: 2026-08-25
**Status**: Accepted

## Context
Precision Loop requires an audio scheduling engine to ensure perfect timing of loops and metronomes. Typical Web Audio applications entangle timing, event queuing, and audio graph manipulation in a single component.

## Decision
We will cleanly separate the scheduling logic into three independent responsibilities:
1. **Scheduler Core**: A pure, manually-ticked event queue operating on absolute time (`@precision-loop/audio-scheduler`).
2. **Scheduler Driver**: The active loop that repeatedly invokes `tick()` (e.g., using a Web Worker or `setInterval`).
3. **Web Audio Sink**: The adapter that converts `ScheduledEvent` into Web Audio operations.

## Consequences
- **Pros**: 
  - The core scheduler is deterministically testable in Node.js without a browser or mocks for `AudioContext`.
  - We can swap the timer mechanism (main thread vs Web Worker) without touching the scheduling logic.
- **Cons**: 
  - Slightly more abstraction overhead.
  - Requires explicit wiring in the application layer.
