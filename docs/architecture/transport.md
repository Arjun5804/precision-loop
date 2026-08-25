# Transport Architecture

## 1. Purpose

The Transport is the orchestration layer responsible for turning
musical user intent into a deterministic audio-time session.

It coordinates:

- Musical Clock
- Audio Scheduler
- Recording Engine
- future Click/Metronome Engine
- future Loop Playback Engine

The Transport understands musical concepts such as:

- bars
- beats
- tempo
- time signature
- count-in
- recording duration
- loop boundaries

It does not perform audio processing or PCM manipulation.

The core responsibility is:

> Convert a musical workflow into a deterministic timeline of
> audio-time operations.

---

## 2. Architectural Position

```text
                         User / UI
                            │
                            │ musical intent
                            ▼
                    ┌─────────────────┐
                    │    Transport    │
                    └───────┬─────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
       Musical Clock   Audio Scheduler  Recording
              │             │             │
              │             │             │
              ▼             ▼             ▼
       Musical timing   Audio events   Exact PCM
                            │
                            ▼
                     Future Click /
                     Playback Engines

The Transport is an orchestration layer, not an audio engine.

3. Responsibilities
Transport owns
transport configuration
session lifecycle
count-in workflow
recording workflow
musical session boundaries
conversion of musical intent into audio-time boundaries
scheduling of transport events
recording-window creation
transport state
session cancellation
session completion
transport-level errors
loop metadata associated with a completed recording
Transport does not own
AudioContext lifecycle
microphone permissions
raw PCM capture
PCM processing
audio effects
audio mixing
audio playback
click sound synthesis
waveform rendering
persistence
authentication
UI rendering
wall-clock timers
4. Existing Dependencies

Transport depends on the following established packages:

@precision-loop/musical-clock
@precision-loop/audio-scheduler
@precision-loop/recording-engine

The dependency direction is:

Musical Clock
      ↑
Transport
      ↓
Audio Scheduler
      ↓
Recording Engine

Transport may depend on the public APIs of these packages.

It must not access their internal implementation details.

5. Musical Clock Relationship

The Musical Clock is authoritative for musical-time calculations.

Transport must not independently implement:

beat duration formulas
bar duration formulas
BPM conversion
time-signature calculations
subdivision calculations

For example, Transport should request the duration of four bars from
the Musical Clock rather than calculating:

4 × beatsPerBar × 60 / BPM

itself.

This prevents duplicate musical-time logic.

6. Audio Scheduler Relationship

The Audio Scheduler is authoritative for scheduling events against the
audio timeline.

Transport creates high-level transport events and schedules them using
the Audio Scheduler.

Transport must not use:

setTimeout
setInterval
Date.now
performance.now
requestAnimationFrame

for audio timing.

The audio timeline is authoritative.

7. Recording Engine Relationship

Transport determines:

when recording should begin
when recording should end

in absolute AudioTime.

Recording Engine determines:

how those audio frames are captured

Transport must never inspect or manipulate PCM data.

The intended flow is:

Musical intent
      ↓
Transport
      ↓
Musical Clock
      ↓
absolute AudioTime
      ↓
Recording Window
      ↓
Recording Engine
      ↓
RecordedTake
8. Core User Workflow

Example configuration:

Tempo:              120 BPM
Time Signature:     4/4
Count-in:           2 bars
Recording Length:   4 bars

The Transport creates:

COUNT-IN
    Bar -2
    Bar -1

RECORDING
    Bar 0
    Bar 1
    Bar 2
    Bar 3

END

At 120 BPM and 4/4:

1 beat = 0.5 seconds
1 bar  = 2 seconds

2-bar count-in = 4 seconds
4-bar recording = 8 seconds

Therefore, if the session starts at:

AudioTime = 100.0

the recording window is:

startTime = 104.0
endTime   = 112.0

These values are determined through Musical Clock calculations rather
than hardcoded duration formulas inside Transport.

9. Session Timeline

Transport should construct a deterministic session timeline before
execution.

Conceptually:

AudioTime
   │
100.0 ───── Count-in bar -2
102.0 ───── Count-in bar -1
104.0 ───── Recording starts
106.0 ───── Recording bar 1
108.0 ───── Recording bar 2
110.0 ───── Recording bar 3
112.0 ───── Recording ends

The timeline is planned before the session begins.

Transport should not continuously recalculate musical boundaries during
execution.

10. Session Start

A transport session should use an explicit future audio start time.

Conceptually:

now
 │
 ├── preparation lead time
 │
 ▼
sessionStartTime
 │
 ├── count-in
 │
 ▼
recordingStartTime
 │
 ├── recording
 │
 ▼
recordingEndTime

The exact preparation lead time should be determined by the scheduler
and recorder requirements.

Transport must not attempt to start a recording at the exact instant
the user presses a UI button.

11. Recording Arming

Because RecordingEngine's ARM command crosses an asynchronous
MessagePort boundary, the recorder must be prepared before the actual
recording boundary.

Conceptually:

              recordingStartTime
                      │
                      ▼
──────────────────────┼────────────────────
          ▲
          │
     arm recorder

The Transport should therefore:

calculate the future recording window
prepare the Recording Engine
arm it sufficiently before the start boundary
schedule transport events
allow the audio timeline to reach the recording boundary
allow RecordingEngine to capture the exact frame interval

Transport must not use a wall-clock timer as compensation.

12. Count-In

The count-in is a musical preparation period before recording begins.

If:

countInBars = 2

and:

timeSignature = 4/4

the Transport produces eight beat events.

Example:

Bar -2:
    Beat 1
    Beat 2
    Beat 3
    Beat 4

Bar -1:
    Beat 1
    Beat 2
    Beat 3
    Beat 4

Recording begins at the next bar boundary.

The first beat of each bar should be distinguishable from the other
beats through event metadata.

Transport does not generate the actual click sound.

13. Click Events

Transport produces scheduled click events.

Conceptually:

interface ClickEvent {
    type: "CLICK";
    audioTime: AudioTime;
    barIndex: number;
    beatIndex: number;
    accent: boolean;
}

The exact event interface should be finalized during implementation.

Transport only produces timing metadata.

A future Click Engine will consume these events and generate audio.

14. Beat and Bar Indexing

External musical display may use human-friendly numbering:

Bar 1
Beat 1

Internal Transport representation should use zero-based coordinates where
practical.

For example:

count-in bar:
barIndex = -2

next:
barIndex = -1

recording:
barIndex = 0

Beat indices are:

0
1
2
3

for 4/4.

This convention should remain deterministic and documented.

15. Recording Window

A recording session produces an exact:

[startTime, endTime)

window.

The recording duration is calculated from the configured musical
duration.

For example:

recordingStartTime = 104.0
recordingEndTime   = 112.0

The Recording Engine converts these values into exact sample-frame
boundaries.

Transport does not perform sample-frame conversion.

16. Recording Completion

Transport considers the recording operation complete only after the
Recording Engine returns a valid RecordedTake.

The expected flow is:

recording boundary reached
        ↓
RecordingEngine captures frames
        ↓
RecordingEngine finalizes
        ↓
RecordedTake
        ↓
Transport receives take
        ↓
validate take metadata
        ↓
session COMPLETED

Transport must not infer completion merely from wall-clock elapsed
time.

17. Loop Representation

A completed recording can be associated with a Loop domain object.

Conceptually:

interface Loop {
    id: string;
    take: RecordedTake;

    musicalDuration: MusicalDuration;

    tempo: Tempo;
    timeSignature: TimeSignature;
}

The exact type should be finalized during implementation.

Playback is outside Transport v0.1.

18. Loop Invariants

For a valid recorded loop:

recording duration corresponds exactly to configured musical duration

and:

RecordedTake.frameCount

must correspond to the exact audio-frame duration returned by the
Recording Engine.

Transport should validate relevant metadata but must not reprocess PCM.

19. Transport State Machine

The recommended state machine is:

IDLE
  │
  ▼
ARMING
  │
  ▼
COUNTING_IN
  │
  ▼
RECORDING
  │
  ▼
COMPLETING
  │
  ▼
COMPLETED

Errors may transition to:

ERROR

Cancellation:

ARMING       ──STOP──→ IDLE
COUNTING_IN  ──STOP──→ IDLE
RECORDING    ──STOP──→ IDLE

A completed session may return to IDLE when explicitly reset/prepared
for another session.

20. State Semantics
IDLE

No active transport session.

ARMING

The session timeline has been calculated and required recording
resources are being prepared.

COUNTING_IN

The session has started on the audio timeline and count-in events are
being emitted.

RECORDING

The configured recording window is active.

COMPLETING

The recording window has ended and the Recording Engine is finalizing
the take.

COMPLETED

A valid RecordedTake has been received and the session has completed.

ERROR

A non-recoverable transport or dependency failure occurred.

21. Cancellation

Stopping a session during:

ARMING
COUNTING_IN
RECORDING

must cancel the active RecordingEngine operation where applicable.

Transport must:

cancel scheduled transport events where supported
cancel the Recording Engine
discard the active session
release session state
return to IDLE

Cancellation must not close the shared AudioContext.

22. Scheduler Event Ownership

Transport owns the semantic meaning of scheduled events.

Audio Scheduler owns the scheduling mechanism.

For example:

Transport:
    "click at bar 1 beat 3"

Audio Scheduler:
    schedule event at AudioTime 108.0

Transport must not manipulate scheduler internals.

23. Event Ordering

Events occurring at the same AudioTime must have deterministic ordering.

For example:

recording boundary
click event

must have a defined ordering if they occur at the same timestamp.

The exact ordering should be explicitly documented during implementation.

The Audio Scheduler's deterministic timestamp + insertion ordering should
be used rather than creating a second event-ordering mechanism.

24. Transport Configuration

The v0.1 configuration should include:

interface TransportConfig {
    tempo: Tempo;
    timeSignature: TimeSignature;
    countInBars: number;
    recordingBars: number;
}

Optional subdivision configuration may be included if required by the
existing Musical Clock.

Validation belongs at the Transport boundary.

Invalid configurations must be rejected before starting a session.

25. Configuration Validation

At minimum:

tempo > 0

countInBars >= 0

recordingBars > 0

timeSignature is valid

all calculated musical durations are finite and positive

Transport should fail before scheduling or recording if configuration
is invalid.

26. Session Planning

The Transport should separate:

planning

from:

execution

A planned session should contain all relevant future boundaries before
execution begins.

Conceptually:

interface TransportPlan {
    sessionStartTime: AudioTime;
    recordingStartTime: AudioTime;
    recordingEndTime: AudioTime;

    countInEvents: ClickEvent[];

    recordingWindow: RecordingWindow;
}

This makes the timing model deterministic and testable.

27. No Wall-Clock Timing

The following APIs are forbidden for transport timing:

setTimeout
setInterval
Date.now
performance.now
requestAnimationFrame

They may only be used for unrelated UI concerns in future application
layers, never for audio event boundaries.

The authoritative timeline is:

AudioContext.currentTime

and scheduled audio events.

28. UI Independence

Transport must not import React or any UI framework.

UI should observe Transport state through a small public API.

Possible future interface:

transport.state
transport.position
transport.subscribe(...)

The exact observation mechanism should be decided during
implementation.

Transport should remain usable from:

React
vanilla JavaScript
automated tests
future desktop wrappers

without modification.

29. Error Handling

Transport should normalize errors from dependencies.

Potential categories include:

INVALID_CONFIGURATION
INVALID_STATE
SCHEDULING_FAILURE
RECORDING_FAILURE
RECORDING_FINALIZATION_FAILURE
SESSION_CANCELLED

Underlying dependency errors should remain available through a causal
chain where appropriate.

Transport must never silently swallow dependency failures.

30. Determinism

Given identical:

tempo
time signature
count-in bars
recording bars
session start AudioTime

Transport must produce the same:

sessionStartTime
recordingStartTime
recordingEndTime
click event positions
recording window

This should be testable without a browser.

31. Testing Strategy
Unit Tests

Test:

configuration validation
session planning
count-in calculations
recording window calculation
zero count-in
one-bar recording
multi-bar recording
different time signatures
different tempos
event generation
deterministic event ordering
cancellation
state transitions
invalid state operations
dependency failures
Integration Tests

Test:

Transport
   ↓
Musical Clock
   ↓
Audio Scheduler

using deterministic fakes.

Recording Integration

Test:

Transport
   ↓
RecordingEngine

with a deterministic fake RecordingEngine before relying on browser
microphone tests.

Actual browser microphone capture remains the responsibility of the
Recording Engine integration suite.

32. Property-Based Testing

Where practical, use property-based tests to verify:

increasing musical positions produce non-decreasing AudioTime
recording duration is positive
recording end is always after recording start
count-in duration is non-negative
generated beat events remain ordered
generated recording windows remain deterministic
33. Performance

Transport must remain lightweight.

It should calculate the session plan once and schedule the required
events rather than repeatedly recalculating musical timing.

Avoid:

per-frame loops
requestAnimationFrame scheduling
continuous polling
unnecessary allocations

The Transport should not run a high-frequency JavaScript timer.

34. Resource Ownership
Musical Clock owns

Musical-time mathematics.

Audio Scheduler owns

Scheduled audio-time event queue.

Recording Engine owns

Microphone and PCM capture.

Transport owns

Session orchestration and lifecycle.

Future Click Engine owns

Actual click sound generation.

Future Loop Playback Engine owns

Loop playback.

No component should silently take ownership of another component's
resources.

35. Future Extensions

The Transport architecture should support future:

loop playback
overdubbing
punch-in recording
count-in customization
free recording mode
pre-roll
metronome mute
tempo changes
time-signature changes
loop quantization
multiple tracks
undo/redo
session persistence
project timelines

without introducing UI dependencies into Transport.

36. Architectural Principle

Transport is the bridge between:

musical intent

and:

audio execution

Its fundamental responsibility is:

Musical workflow
       ↓
deterministic musical timeline
       ↓
absolute AudioTime
       ↓
scheduled audio operations

It must never become:

a UI controller
an audio processor
a timer
a PCM manipulation layer

The Transport should remain a deterministic orchestration boundary.