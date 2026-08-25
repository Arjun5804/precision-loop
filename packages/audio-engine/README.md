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

## AudioWorklet Serving

The `audio-engine` package includes a foundation AudioWorklet processor to verify Web Audio infrastructure.
During the package build process, this processor is compiled into a static JavaScript asset located at:

```
@precision-loop/audio-engine/dist/worklets/foundation-processor.js
```

**Important:** Web Audio requires worklets to be loaded from a distinct URL, not from inline strings or Blob URLs. 
The consuming application must ensure this file is served as a static asset by its build tool/server (e.g., via Vite's `?url` import, Webpack's file-loader, or copying it to a `public/` directory).

Once the asset has a stable URL, pass it to the engine to initialize the infrastructure:

```typescript
const engine = new AudioEngine();
await engine.initialize();
await engine.initializeWorklets('/path/to/served/foundation-processor.js');
```

## Important Note
This package does NOT implement audio processing, DSP, mixing, metronomes, recording, or the UI layer. It exists solely to manage the underlying Web Audio infrastructure.
