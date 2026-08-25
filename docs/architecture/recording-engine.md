# Recording Engine Architecture

## 1. Purpose

The Recording Engine is the Precision Loop subsystem responsible for
capturing raw PCM audio from a selected input device for an exact
audio-time window.

It is deliberately separated from musical-time calculations,
scheduling, playback, mixing, effects, persistence, and UI.

Its primary responsibility is:

> Given an exact audio-time capture window, produce an exact-length
> in-memory PCM recording.

---

## 2. Architectural Position

```text
Musical Clock
      │
      │ musical timing → absolute AudioTime
      ▼
Audio Scheduler
      │
      │ scheduled control
      ▼
Recording Engine
      │
      │ capture window
      ▼
Recording AudioWorklet
      │
      │ raw PCM
      ▼
Recorded Take

The Recording Engine consumes audio-time information but does not
understand BPM, bars, beats, time signatures, or subdivisions.

3. Responsibilities
Recording Engine owns
microphone acquisition
selected input device
MediaStream lifecycle
recording-specific AudioNodes
Recording AudioWorklet
recording state
capture-window configuration
PCM buffering
finalization
cancellation
recording limits
recording-specific cleanup
Recording Engine does not own
BPM
time signature
musical bars/beats
metronome
musical-time calculations
audio scheduling
playback
effects
mixing
waveform rendering
persistence
authentication
UI
4. AudioContext Ownership

The shared AudioContext remains exclusively owned by
@precision-loop/audio-engine.

The Recording Engine may create nodes using the shared context but must
never create or close the application's primary AudioContext.

The Recording Engine must never close the shared context during cleanup.

5. Input Audio Path
Microphone
    │
    ▼
MediaStream
    │
    ▼
MediaStreamAudioSourceNode
    │
    ▼
Recording AudioWorkletNode
    │
    ▼
PCM capture

The recording path is independent from the master playback graph.

Recording must not automatically enable microphone monitoring.

6. Recording Window

A recording is defined by an audio-time window:

[startTime, endTime)

where:

startTime < endTime

The end boundary is exclusive.

Internally, the window is converted into sample-frame coordinates:

[startFrame, endFrame)

The exact number of frames is:

endFrame - startFrame

This half-open representation prevents off-by-one errors at loop
boundaries.

7. Audio Time to Frame Conversion

The actual AudioContext.sampleRate is authoritative.

Precision Loop uses the canonical conversion:

frame = Math.round(audioTimeSeconds * sampleRate)

The Recording Engine must use the same conversion policy as the
Musical Clock and must not introduce a different rounding rule.

8. Why Frame-Based Capture

AudioTime is useful for coordination with the Audio Scheduler.

PCM audio is inherently frame-based.

Therefore:

External boundary:
AudioTime

Internal capture boundary:
Sample Frame

Once a capture window has been resolved into frame coordinates, the
Recording Engine operates in sample-frame space.

9. Recording State Machine
IDLE
  │
  ▼
PREPARING
  │
  ▼
READY
  │
  ▼
ARMED
  │
  ▼
RECORDING
  │
  ▼
FINALIZING
  │
  ▼
COMPLETED

Errors transition to:

ERROR

Cancellation returns to:

IDLE

Only one recording may be active per Recording Engine instance.

10. State Semantics
IDLE

No active recording resources exist.

PREPARING

The microphone stream and recording graph are being prepared.

READY

The recording input is available.

ARMED

The recording window has been configured, but the start boundary has
not yet been reached.

RECORDING

Audio frames inside the requested capture window are being collected.

FINALIZING

Captured PCM chunks are being assembled and validated.

COMPLETED

A valid RecordedTake has been produced.

ERROR

A non-recoverable recording error has occurred.

11. Armed Recording

The microphone and recording Worklet should be active before the exact
recording boundary is reached.

The system should not rely on a main-thread callback occurring at the
exact musical boundary to begin capture.

Conceptually:

Prepare
   │
   ▼
Microphone active
   │
   ▼
Recording Worklet active
   │
   ▼
ARMED
   │
   │ exact start boundary
   ▼
RECORDING

This allows capture to be controlled using the audio timeline rather
than wall-clock UI timing.

12. Recording Worklet

The Recording AudioWorklet is responsible for:

processing incoming audio blocks
tracking the relevant sample-frame positions
selecting frames inside the active capture window
producing PCM chunks
communicating captured chunks to the Recording Engine

It must not contain musical-time logic.

It must not know BPM, bars, beats, or time signatures.

13. Render Quantum Independence

The Recording Worklet must not assume that a processing block always
contains 128 frames.

Actual input/output buffer lengths must be inspected.

Capture boundaries may occur in the middle of a render block.

For example:

Render block:
[0 ... 127]

Recording starts:
frame 100

Only:
[100 ... 127]

belongs to the recording.

Likewise, the final block may contain samples both inside and outside
the capture window.

14. Exact Boundary Example

Given:

startFrame = 100
endFrame = 350

the required capture range is:

[100, 350)

Therefore:

frameCount = 350 - 100
           = 250

Frame 350 must not be included.

15. PCM Representation

A completed recording is represented conceptually as:

interface RecordedTake {
    id: string;
    sampleRate: number;
    channelCount: number;
    frameCount: number;
    channels: Float32Array[];
    startTime: AudioTime;
    endTime: AudioTime;
}

Version 0.1 supports mono capture.

The data model remains channel-oriented so stereo can be introduced
later without redesigning the fundamental representation.

16. RecordedTake Invariants

For every valid take:

frameCount === endFrame - startFrame

and:

channels.length === channelCount

and for every channel:

channels[i].length === frameCount

The sample rate must equal the sample rate of the AudioContext used
during capture.

17. Buffering Strategy

The AudioWorklet must not communicate individual samples through
postMessage.

Audio should be transferred in chunks.

Version 0.1 should use transferable buffers where appropriate.

Version 0.1 does not require:

SharedArrayBuffer
cross-origin isolation
a lock-free ring buffer
a third-party audio transport library

These may be evaluated later if profiling demonstrates a real need.

18. Memory Management

Recording duration must be bounded.

The Recording Engine should expose a configurable maximum recording
duration.

The default v0.1 limit should be conservative enough to avoid
unbounded browser memory consumption.

A recommended initial value is approximately 10 minutes.

The limit is a safety guardrail, not a permanent product requirement.

19. Microphone Permissions

Microphone permission must not be requested during AudioEngine
initialization.

Permission should be requested only when recording is explicitly
prepared.

Permission failures must be converted into stable Recording Engine
errors.

20. Device Failures

If the selected input device becomes unavailable during recording:

stop capture safely
transition to an error state
release recording resources
report the failure

The engine must never silently switch to another input device.

21. Cancellation

Cancellation is supported while:

ARMED
RECORDING

Cancellation must:

discard captured PCM
stop the recording-specific stream
disconnect recording-specific nodes
release temporary buffers
return to IDLE

No RecordedTake is produced.

22. Completion

When the exclusive end boundary is reached:

stop accepting capture frames
finalize PCM chunks
validate frame count
construct RecordedTake
release temporary recording resources
transition to COMPLETED

Completion does not automatically start playback.

23. Resource Ownership
AudioEngine owns
AudioContext
master graph
global audio-device infrastructure
RecordingEngine owns
MediaStream
MediaStreamAudioSourceNode
Recording AudioWorkletNode
recording buffers
recording state
RecordedTake owns
finalized PCM data
recording metadata
24. Scheduler Relationship

The Recording Engine does not schedule itself.

A higher-level transport/planner determines the recording window.

The intended flow is:

Musical Clock
    │
    │ musical duration
    ▼
Recording Window
    │
    │ absolute AudioTime
    ▼
Audio Scheduler
    │
    ▼
Recording Engine

The Recording Engine must not use:

setTimeout
setInterval
Date.now()
performance.now()

to determine audio capture boundaries.

25. Monitoring

Microphone monitoring is intentionally excluded from Recording Engine
v0.1.

Future architecture may provide:

Input
 ├── Recording
 └── Monitoring → Master Bus

Monitoring must be explicitly enabled by the user because microphone
monitoring can create acoustic feedback.

26. Multitrack Compatibility

Version 0.1 supports one active recording per Recording Engine
instance.

Future multitrack recording can use multiple Recording Engine
instances sharing:

the same AudioContext
the same Audio Scheduler
the same Audio Engine

This avoids making one recorder responsible for every project track.

27. Testing Strategy

Three levels of verification are required.

Unit Tests

Verify:

state transitions
recording-window validation
frame conversion
exact frame count
cancellation
concurrency
limits
RecordedTake invariants
Worklet Tests

Verify:

start boundary
end boundary
partial-block capture
exact frame count
cancellation
Browser Integration

Verify using a real browser:

microphone permission
device acquisition
MediaStream source
Recording AudioWorklet
actual PCM capture
exact frame count

Node mocks must not be presented as proof of browser audio capture.

28. Critical Test

Given:

sampleRate = 48000
startTime = 2
endTime = 6

Expected:

startFrame = 96000
endFrame = 288000
frameCount = 192000

The resulting take must contain exactly 192000 frames.

29. Architectural Principle

The Recording Engine is an audio-runtime subsystem, not a musical-time
subsystem.

Its core abstraction is:

capture this exact audio-frame interval

rather than:

record four bars

The conversion from musical intent to audio-time boundaries belongs
outside this subsystem.

This separation allows the Recording Engine to remain reusable for
future recording workflows that are not tied to loops.

30. Future Extensions

The architecture should permit future:

stereo recording
multitrack recording
waveform generation
playback
effects
audio export
persistent projects
undo/redo
recording takes

without changing the fundamental capture-window and PCM model.