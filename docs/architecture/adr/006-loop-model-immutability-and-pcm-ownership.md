# ADR 006: Loop Model Immutability and PCM Ownership

## Context
The application records raw audio using the `RecordingEngine`, which produces a `RecordedTake` containing `Float32Array` PCM buffers. The domain model needs to represent these audio assets safely without exploding memory.

## Decision
1. **Ownership Transfer:** The `Take` domain object accepts PCM buffers via a factory method (`session.createTake()`). It assumes ownership without copying the arrays.
2. **Immutable-by-Contract:** `Float32Array` in JavaScript is not inherently immutable. Instead of copying large arrays (e.g., ~115MB for a 10-minute 48kHz mono recording) to freeze them, the domain enforces an immutable-by-contract design. The `Take` exposes no mutation API for the PCM buffers, and callers must treat them as read-only.
3. **Encapsulated State:** `Session` and `Track` are stateful aggregates with private state and validated mutation methods (e.g., `setVolume`). Public writable fields are forbidden.

## Consequences
- Memory footprint remains stable because PCM buffers are not duplicated.
- Testing is straightforward as domain objects remain pure.
- Future DSP or destructive editing will require allocating new buffers.
