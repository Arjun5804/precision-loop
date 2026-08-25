# ADR-004: Sample-Accurate Recording with AudioWorklet

- **Status:** Accepted
- **Date:** 2026-08-25
- **Decision:** Use AudioWorklet-based raw PCM capture for the Recording Engine.

---

## Context

Precision Loop is designed around deterministic musical timing.

A core product requirement is the ability to record a loop for an exact
number of musical bars.

For example:

```text
120 BPM
4/4
2-bar count-in
4-bar recording

The resulting recording must have an exact audio duration corresponding
to the calculated musical boundaries.

A recording mechanism based on human button timing or main-thread
timers would introduce timing uncertainty.

The browser's MediaRecorder API is also not an appropriate foundation
for this requirement because it is primarily an encoded media recording
API and does not provide the level of direct raw PCM frame control
required by Precision Loop.

Decision

The Recording Engine will capture raw PCM audio using an
AudioWorkletProcessor.

The recording path is:

Microphone
    ↓
MediaStream
    ↓
MediaStreamAudioSourceNode
    ↓
Recording AudioWorkletNode
    ↓
PCM chunks
    ↓
RecordedTake

The Recording Engine will operate on an explicit capture window:

[startTime, endTime)

which is converted into:

[startFrame, endFrame)

using the actual AudioContext.sampleRate.

Frame Conversion

Precision Loop uses the canonical conversion:

frame = Math.round(audioTimeSeconds * sampleRate)

This keeps audio-time/frame conversion deterministic and consistent
with the existing Musical Clock implementation.

Boundary Semantics

Capture windows use half-open intervals:

[startFrame, endFrame)

Therefore:

frameCount = endFrame - startFrame

The end frame is never included.

This eliminates ambiguity and prevents off-by-one errors when recorded
audio is later looped.

Why AudioWorklet

AudioWorklet provides a dedicated audio processing context suitable for
custom real-time audio processing.

It allows Precision Loop to operate directly on PCM audio frames rather
than depending on UI-thread timing.

This makes it possible to:

capture exact frame ranges
handle boundaries inside render blocks
avoid wall-clock timers for audio timing
keep the recording path independent of React/UI scheduling
retain direct control over PCM data
Why Not MediaRecorder

MediaRecorder is intentionally not used as the core recording
mechanism.

The project's requirements include deterministic sample boundaries and
raw PCM access.

Using MediaRecorder would introduce an abstraction around encoded media
that is unnecessary for the core recording path and less suitable for
exact frame-level control.

MediaRecorder may still be evaluated for unrelated future use cases,
but it is not the foundation of Precision Loop recording.

Why Not Main-Thread Recording

The main thread is responsible for UI and application orchestration.

It must not be responsible for determining exact audio capture
boundaries using:

setTimeout
setInterval
Date.now()
performance.now()

Main-thread scheduling is not the authoritative audio timeline.

The AudioContext timeline and AudioWorklet processing path are used
instead.

Why Not SharedArrayBuffer Yet

A SharedArrayBuffer/ring-buffer architecture could provide a more
advanced audio transport mechanism.

However, it would introduce additional deployment requirements such as
cross-origin isolation.

For Recording Engine v0.1, transferable PCM chunks are sufficient and
simpler.

SharedArrayBuffer may be introduced later if profiling demonstrates
that the simpler approach cannot meet performance requirements.

Consequences
Positive
deterministic PCM capture
explicit sample-frame boundaries
clear separation from musical timing
no dependence on UI-thread timers
direct control over recorded audio
strong foundation for precise looping
straightforward future waveform/export support
Negative
more implementation complexity than MediaRecorder
requires AudioWorklet asset/build handling
requires careful buffer management
browser integration testing is necessary
microphone permissions and device failures require explicit handling
Architectural Boundary

The Recording Engine does not understand musical concepts.

It receives an audio-time capture window.

The conversion:

bars / beats / BPM / time signature
        ↓
absolute AudioTime

belongs to the Musical Clock / transport layer.

The conversion:

AudioTime
    ↓
sample frames

belongs to the audio recording boundary.

This keeps musical-time logic and audio-runtime logic independently
testable.

Future Considerations

This decision provides a foundation for:

multitrack recording
stereo recording
waveform generation
precise loop playback
effects
offline rendering
audio export
persistent takes

without requiring a fundamental redesign of the capture model.