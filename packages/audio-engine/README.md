# Precision Loop Audio Engine

Foundational browser audio runtime for Precision Loop.

This package provides a strict boundary between deterministic domain logic and the browser's Web Audio API.

## Responsibilities
- `AudioContext` lifecycle and state management
- Audio device discovery (inputs and outputs)
- Output device selection and capability testing
- Master audio graph construction
- AudioWorklet loading and initialization
- Exposing the `AudioContext.currentTime` as an `AudioTimeSource` for the `Audio Scheduler`

## Architecture
- **One AudioContext:** An `AudioEngine` strictly owns exactly one `AudioContext`.
- **Initialization:** Context creation and worklet loading are explicit and asynchronous.
- **Progressive Enhancement:** Capabilities like output-device selection or base latency are feature-detected and handled gracefully.

## Important Note
This package does NOT implement audio processing, DSP, mixing, metronomes, recording, or the UI layer. It exists solely to manage the underlying Web Audio infrastructure.
