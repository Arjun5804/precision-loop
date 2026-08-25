# Recording Engine

The Recording Engine is responsible for capturing sample-accurate audio from the microphone to a raw Float32Array on the main thread, without any React, UI, effects, or persistence.

## Architecture
The Recording Engine runs an `AudioWorkletNode` connected to a `MediaStreamAudioSourceNode` and sends chunks of PCM data asynchronously to the main thread. 

## ARM Contract
Because the `arm()` command crosses the MessagePort asynchronously to the audio thread, **you must call `arm()` with sufficient lead time** before the target `startTime`. 
The engine currently strictly enforces a minimum lookahead of 50ms (`startTime` must be at least 50ms in the future of `AudioContext.currentTime`).
Do not use wall-clock timers (`setTimeout`) to compensate for scheduling latency. Use the exact `AudioTime` boundaries and ensure they are appropriately in the future.

## Errors
- `InvalidWindowError`: Thrown if `startTime` is not sufficiently in the future.
- `FinalizationFailureError`: Thrown if the exact frame invariant is violated during recording completion.
- `BufferLimitExceededError`: Thrown if the recording duration exceeds the allowed maximum.
