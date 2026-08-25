# Precision Loop — Recording Engine v0.1

## 1. Objective

Implement the foundational recording subsystem for Precision Loop.

The Recording Engine captures raw PCM audio from a selected microphone
input for an exact audio-time window and returns an immutable in-memory
RecordedTake.

The subsystem must provide deterministic frame boundaries and must not
depend on wall-clock timers.

---

## 2. Architectural Position

Musical Clock
    ↓
Audio Scheduler
    ↓
Recording Engine
    ↓
AudioWorklet
    ↓
PCM
    ↓
Recorded Take

The Recording Engine is responsible for audio capture only.

It does not understand BPM, bars, beats, time signatures, or musical
subdivisions.

---

## 3. Scope

### Included

- microphone permission/acquisition
- input device selection
- MediaStreamAudioSourceNode
- Recording AudioWorklet
- exact capture window
- sample-frame conversion
- PCM buffering
- mono capture
- RecordedTake creation
- cancellation
- cleanup
- recording limits
- deterministic tests
- browser integration verification

### Excluded

- BPM
- musical time
- metronome
- loop transport
- playback
- effects
- mixing
- waveform UI
- persistence
- authentication
- cloud synchronization
- React UI

---

## 4. Core Invariant

A recording window is represented as:

[startTime, endTime)

with:

startTime < endTime

Internally the capture window becomes:

[startFrame, endFrame)

The number of frames is:

endFrame - startFrame

The end frame is never included.

---

## 5. Frame Conversion

Use the canonical Precision Loop conversion policy:

frame = Math.round(audioTimeSeconds * sampleRate)

Do not introduce an independent rounding policy.

The Recording Engine must use the actual AudioContext sampleRate.

Never assume 44100 Hz or 48000 Hz.

---

## 6. RecordingWindow

Conceptually:

type RecordingWindow = {
    startTime: AudioTime;
    endTime: AudioTime;
}

The engine derives:

startFrame
endFrame

from the runtime sample rate.

The derived frame range must be half-open.

---

## 7. Recording State

States:

IDLE
PREPARING
READY
ARMED
RECORDING
FINALIZING
COMPLETED
ERROR

Cancellation returns to IDLE.

Only one active recording is allowed per Recording Engine instance.

---

## 8. State Semantics

### IDLE

No active microphone recording resources.

### PREPARING

Acquiring microphone/device resources and constructing the recording
graph.

### READY

Input is available and recording can be armed.

### ARMED

Recording window has been configured, but the start boundary has not
yet been reached.

### RECORDING

Audio frames inside the requested window are being captured.

### FINALIZING

Captured chunks are being assembled into the final RecordedTake.

### COMPLETED

A valid RecordedTake has been produced.

### ERROR

A non-recoverable recording error occurred.

---

## 9. Microphone Acquisition

Use getUserMedia only when recording is explicitly requested.

Do not acquire microphone permission during AudioEngine initialization.

The selected device may be provided using deviceId.

Default v0.1 capture is mono.

---

## 10. Input Graph

The recording path is:

Microphone
    ↓
MediaStream
    ↓
MediaStreamAudioSourceNode
    ↓
Recording AudioWorkletNode

The Recording Engine owns the recording-specific nodes.

The Audio Engine owns the root AudioContext.

---

## 11. Monitoring

Recording must not automatically enable microphone monitoring.

Monitoring may be implemented later as a separate path:

Input
 ├── Recording
 └── Monitoring

This avoids unexpected feedback.

---

## 12. Recording Worklet

The Recording Worklet is responsible for:

- receiving audio render blocks
- determining frame positions
- selecting frames belonging to the active capture window
- producing PCM chunks
- communicating chunks to the main-thread Recording Engine

The Worklet must not know BPM or musical concepts.

---

## 13. Render Block Handling

Never assume a permanent fixed render quantum size.

Inspect actual buffer lengths.

Capture boundaries may occur in the middle of a render block.

The Worklet must support partial-block boundaries.

---

## 14. Exact Boundary Requirement

If:

startFrame = 100
endFrame = 350

the recorder must return exactly:

250 frames

It must not capture:

384 frames
or
256 frames
or
251 frames.

The exact interval is:

[100, 350)

---

## 15. PCM Representation

RecordedTake:

interface RecordedTake {
    id: string;
    sampleRate: number;
    channelCount: number;
    frameCount: number;
    channels: Float32Array[];
    startTime: AudioTime;
    endTime: AudioTime;
}

For v0.1:

channelCount = 1

channels[0].length === frameCount

---

## 16. RecordedTake Invariants

For every valid take:

frameCount = endFrame - startFrame

channels.length = channelCount

channels[i].length = frameCount

sampleRate equals the AudioContext sampleRate used during capture.

---

## 17. Buffering

Do not send individual samples through MessagePort.

Capture audio in chunks.

Transfer chunk buffers efficiently to the main thread.

Do not require SharedArrayBuffer for v0.1.

Do not require cross-origin isolation for the recording engine.

---

## 18. Memory Safety

Recording duration must be bounded.

Expose a configurable maximum recording duration.

Provide a conservative default suitable for browser memory usage.

If the maximum is reached:

- stop capture safely
- finalize or fail according to the defined policy
- release temporary resources
- report a stable error code

---

## 19. Recommended Initial Limit

Use approximately:

10 minutes

as the default maximum duration for v0.1.

The value must be configurable.

Do not treat this value as a permanent product requirement.

---

## 20. Cancellation

Cancellation is supported in:

ARMED
RECORDING

Cancellation must:

- discard captured audio
- release recording resources
- stop the microphone stream for v0.1
- return the engine to IDLE

Cancellation must not produce a RecordedTake.

---

## 21. Completion

On reaching endFrame:

1. stop accepting capture frames
2. finalize PCM chunks
3. validate frame count
4. construct RecordedTake
5. release temporary recording resources
6. transition to COMPLETED

No automatic playback occurs.

---

## 22. Device Failure

If the selected microphone becomes unavailable:

- transition to ERROR
- stop capture
- clean up stream/resources
- report a stable domain error

Do not silently switch to another input device.

---

## 23. Permission Errors

Permission denial must be converted into a domain error.

Do not leak raw browser DOM exceptions as the primary application
contract.

---

## 24. Concurrency

Only one recording may be active per Recording Engine instance.

Attempting to start/arm another recording while one is active must
return a stable error.

Future multitrack support may use multiple Recording Engine instances
sharing the same AudioEngine.

---

## 25. Scheduler Integration

The Recording Engine does not own scheduling.

A higher-level transport/planner will determine:

startTime
endTime

The Audio Scheduler is responsible for precise control timing.

The Recording Engine is responsible for capturing the requested
window.

Do not introduce timers.

Do not use Date.now() or performance.now() for audio capture boundaries.

---

## 26. Scheduler/Recorder Relationship

The intended relationship is:

Musical Clock
    ↓
calculate musical boundaries
    ↓
absolute AudioTime
    ↓
Audio Scheduler
    ↓
Recording Engine

The Recording Engine receives an explicit audio-time capture window.

It does not recalculate musical timing.

---

## 27. Worklet Communication

Main thread sends control/configuration commands.

Worklet sends PCM chunks.

Do not send individual samples via postMessage.

Do not require a third-party audio transport library.

---

## 28. Resource Ownership

AudioEngine owns:

- AudioContext
- root graph
- global device infrastructure

RecordingEngine owns:

- MediaStream
- MediaStreamAudioSourceNode
- recording AudioWorkletNode
- recording buffers
- recording state

RecordedTake owns its finalized PCM data.

---

## 29. Cleanup

Cleanup must be idempotent.

After completion/cancellation/error:

- stop MediaStream tracks
- disconnect recording-specific nodes
- remove recording-specific listeners
- release temporary buffers
- terminate active recording state

Do not close the shared AudioContext.

---

## 30. Error Model

Use a small stable error model.

Potential error codes:

PERMISSION_DENIED
DEVICE_UNAVAILABLE
INVALID_WINDOW
NOT_READY
ALREADY_RECORDING
BUFFER_LIMIT_EXCEEDED
CAPTURE_FAILURE
FINALIZATION_FAILURE

Do not create an excessive error hierarchy.

---

## 31. Testing

### Unit tests

Test:

- state transitions
- valid/invalid recording windows
- frame conversion
- exact frame count
- partial-block boundaries
- no extra end frame
- cancellation
- recording limits
- concurrency
- error handling
- RecordedTake invariants

### Worklet tests

Verify:

- frame selection
- partial-block boundaries
- exact capture length
- start/end behavior
- cancellation

### Browser integration

Verify using a real browser:

- microphone permission
- microphone device acquisition
- MediaStreamAudioSourceNode
- Recording AudioWorklet
- actual PCM capture
- exact frame count for a known test input

Node mocks must not be presented as proof of actual browser audio capture.

---

## 32. Critical Boundary Test

Given:

sampleRate = 48000
startTime = 2
endTime = 6

Expected:

startFrame = 96000
endFrame = 288000
frameCount = 192000

The resulting take must contain exactly 192000 frames.

---

## 33. Critical Partial-Block Test

Given:

block size = 128
startFrame = 100
endFrame = 350

Expected captured range:

[100, 350)

Expected frame count:

250

The implementation must correctly slice the first and final render
blocks.

---

## 34. No Extra End Frame

For:

[startFrame, endFrame)

frame endFrame must not be included.

This must have an explicit regression test.

---

## 35. No Wall Clock

The Recording Engine must never use:

setTimeout
setInterval
Date.now
performance.now

for determining audio capture boundaries.

---

## 36. No MediaRecorder

MediaRecorder must not be used as the core capture mechanism.

The core recorder must capture raw PCM through AudioWorklet.

---

## 37. Future Compatibility

The data model should support future:

- stereo recording
- multiple tracks
- waveform generation
- playback
- effects
- export
- persistence

without changing the fundamental RecordedTake representation.

---

## 38. Documentation

Create:

docs/architecture/recording-engine.md

Document:

- recording state machine
- capture window
- frame conversion
- Worklet architecture
- buffer ownership
- microphone lifecycle
- scheduler integration
- resource cleanup
- memory limits
- future multitrack architecture

---

## 39. ADR

Create:

docs/architecture/adr/004-sample-accurate-recording.md

Decision:

Use AudioWorklet/raw PCM capture rather than MediaRecorder because
Precision Loop requires deterministic sample/frame boundaries and
direct control over captured audio.

---

## 40. Verification

Run:

npm run typecheck
npm test
npm run build

All must pass.

Additionally perform a browser integration test of real microphone
capture.

---

## 41. Scope Protection

Do NOT implement:

- loop playback
- metronome
- effects
- mixer
- waveform UI
- export
- persistence
- authentication
- React UI
- cloud synchronization
- AI

This phase is Recording Engine v0.1 only.