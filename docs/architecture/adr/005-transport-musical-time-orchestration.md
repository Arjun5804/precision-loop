# ADR-005: Transport as the Musical-Time Orchestration Layer

- **Status:** Accepted
- **Date:** 2026-08-25

---

## Context

Precision Loop must support workflows such as:

```text
120 BPM
4/4
2-bar count-in
4-bar recording

The system must produce a recording whose boundaries correspond
precisely to the requested musical duration.

Several existing subsystems already have clearly defined
responsibilities:

Musical Clock performs musical-time mathematics.
Audio Scheduler schedules events on the audio timeline.
Audio Engine owns the Web Audio runtime.
Recording Engine captures exact PCM frame ranges.

A layer is therefore required to coordinate these systems according to
user-level musical intent.

Without such a layer, UI code would become responsible for:

calculating bar durations
determining recording boundaries
scheduling clicks
coordinating recording
handling cancellation
managing transport state

This would create duplicated timing logic and make accurate behavior
difficult to maintain.

Decision

Introduce a dedicated Transport layer responsible for orchestrating
musical workflows.

Transport receives configuration such as:

tempo
time signature
count-in bars
recording bars

and produces a deterministic session plan containing:

session start time
count-in events
recording start time
recording end time
recording window
transport state transitions

Transport delegates:

musical calculations → Musical Clock

audio-time scheduling → Audio Scheduler

PCM capture → Recording Engine

Transport itself performs no audio processing.

Audio Timeline Authority

AudioContext time is the authoritative execution timeline.

Transport must not use:

setTimeout
setInterval
Date.now
performance.now
requestAnimationFrame

for audio timing.

The Transport calculates future AudioTime boundaries and relies on the
Audio Scheduler for deterministic scheduling.

Session Planning

Transport separates planning from execution.

Conceptually:

User configuration
       ↓
Transport Plan
       ↓
absolute AudioTime boundaries
       ↓
Audio Scheduler / Recording Engine

This allows session timing to be tested deterministically without a
browser.

Count-In Decision

Count-in is represented as scheduled musical events rather than actual
audio generation.

For example:

2 bars × 4/4

Beat events:
1 2 3 4
1 2 3 4

Transport produces event metadata.

A future Click Engine is responsible for turning those events into
audio.

This prevents Transport from becoming coupled to DSP or sound
generation.

Recording Decision

Transport determines the exact recording window:

[startTime, endTime)

and gives that window to Recording Engine.

Recording Engine remains responsible for converting AudioTime to exact
sample frames and capturing PCM.

This preserves the separation between musical-time orchestration and
audio-runtime capture.

Consequences
Positive
clear separation of concerns
deterministic musical workflows
UI-independent transport
reusable timing logic
easy unit testing
clean integration with Recording Engine
future support for playback and overdubbing
no dependence on unreliable wall-clock timers
Negative
introduces another architectural layer
requires explicit coordination between multiple subsystems
transport/session state must be carefully defined
event ownership must remain clear
Future Extensions

This architecture can later support:

loop playback
overdubbing
punch-in recording
metronome controls
quantization
tempo changes
multiple tracks
project/session timelines

without changing the fundamental responsibility of Transport.

Architectural Principle

Transport is the bridge between:

musical intent

and:

audio execution

It owns orchestration, not audio processing.