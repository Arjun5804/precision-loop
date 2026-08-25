# Transport v0.1 Implementation Specification

## 1. Objective

Implement the foundational Transport package for Precision Loop.

The Transport converts musical configuration and user intent into a
deterministic audio-time session plan and coordinates:

- Musical Clock
- Audio Scheduler
- Recording Engine

The package must be UI-independent and deterministic.

---

# 2. Package

Create:

```text
packages/transport/

Suggested package name:

@precision-loop/transport
3. Scope

Version 0.1 supports:

tempo
time signature
count-in bars
recording bars
session planning
count-in event generation
recording-window generation
state management
recording orchestration
cancellation
completion
dependency error propagation
deterministic unit tests
integration tests with fakes

Version 0.1 does NOT implement:

click audio generation
loop playback
overdubbing
effects
mixing
waveform rendering
persistence
UI
React
authentication
network communication
wall-clock timers
4. Dependencies

Transport may depend on:

@precision-loop/musical-clock
@precision-loop/audio-scheduler
@precision-loop/recording-engine

Use only public APIs.

Do not access internal package implementation details.

5. Core Configuration

Implement a configuration equivalent to:

interface TransportConfig {
    tempo: Tempo;
    timeSignature: TimeSignature;
    countInBars: number;
    recordingBars: number;
}

Optional subdivision configuration may be supported if required by the
existing Musical Clock API.

6. Configuration Validation

Reject invalid configuration before starting a session.

Required invariants:

tempo > 0

countInBars >= 0

recordingBars > 0

timeSignature is valid

All calculated durations must be finite and positive where applicable.

Configuration errors must use stable domain errors.

7. Transport State

Implement:

type TransportState =
    | "IDLE"
    | "ARMING"
    | "COUNTING_IN"
    | "RECORDING"
    | "COMPLETING"
    | "COMPLETED"
    | "ERROR";

State transitions:

IDLE
  ↓
ARMING
  ↓
COUNTING_IN
  ↓
RECORDING
  ↓
COMPLETING
  ↓
COMPLETED

Cancellation:

ARMING
COUNTING_IN
RECORDING
    ↓
STOP
    ↓
IDLE

Errors may transition to:

ERROR
8. Invalid State Operations

Examples:

start() while not IDLE
stop() while IDLE
start() while already active

must fail deterministically.

Do not silently reset an active session.

9. Session Planning

Separate planning from execution.

Create a deterministic plan equivalent to:

interface TransportPlan {
    sessionStartTime: AudioTime;
    recordingStartTime: AudioTime;
    recordingEndTime: AudioTime;

    recordingWindow: RecordingWindow;

    countInEvents: ClickEvent[];
}

The exact public/private visibility should be decided during
implementation.

10. Session Start Time

The Transport must receive or derive an appropriate future
sessionStartTime.

It must not use:

Date.now()
performance.now()
setTimeout()
setInterval()
requestAnimationFrame()

as the authoritative timing mechanism.

Use the shared audio timeline and existing Audio Scheduler semantics.

The implementation must leave sufficient lead time for:

RecordingEngine preparation
RecordingEngine ARM message delivery
Audio Scheduler lookahead

Do not attempt to arm RecordingEngine exactly at the recording boundary.

11. Count-In Duration

Use Musical Clock to calculate the duration of:

countInBars

For example:

120 BPM
4/4
2 bars

produces:

8 beats

and:

4 seconds

Do not reproduce the BPM/bar duration formula inside Transport.

12. Recording Duration

Use Musical Clock to calculate:

recordingBars

duration.

For example:

120 BPM
4/4
4 bars

produces:

16 beats
8 seconds

Again, this calculation belongs to Musical Clock.

13. Recording Window

Calculate:

recordingStartTime =
    sessionStartTime + countInDuration

recordingEndTime =
    recordingStartTime + recordingDuration

Represent the resulting window as:

[startTime, endTime)

Pass this exact window to RecordingEngine.

Transport must not convert it into sample frames.

14. Count-In Events

Generate one click event per beat.

For 4/4 and two bars:

bar -2:
    beat 0
    beat 1
    beat 2
    beat 3

bar -1:
    beat 0
    beat 1
    beat 2
    beat 3

The first beat of every bar must be marked as accented.

Conceptual type:

interface ClickEvent {
    type: "CLICK";
    audioTime: AudioTime;
    barIndex: number;
    beatIndex: number;
    accent: boolean;
}

Do not generate audio.

15. Click Event Timing

Beat event times must be derived through Musical Clock.

For each beat:

event.audioTime

must be deterministic.

Events must be strictly non-decreasing in AudioTime.

For normal valid configurations, distinct beats should have distinct
AudioTimes.

16. Bar Indexing

Use zero-based internal beat indexing.

Recording bars begin at:

barIndex = 0

Count-in bars may use:

countInBars = 2

barIndex = -2
barIndex = -1

This makes the recording boundary naturally align with:

barIndex = 0
17. Recording Preparation

Before the recording boundary:

calculate the complete session plan
prepare RecordingEngine
arm RecordingEngine with the exact future window
schedule count-in events
begin session

Do not wait until recordingStartTime to prepare or arm the recorder.

18. Recording Engine Interaction

Transport should interact through the RecordingEngine public API.

Conceptually:

await recordingEngine.prepare(workletUrl, recordingConfig);

await recordingEngine.arm({
    startTime: plan.recordingStartTime,
    endTime: plan.recordingEndTime,
});

Use the actual public API of the current RecordingEngine package rather
than inventing a new interface.

If the current API differs, adapt the implementation to the existing
contract.

19. Recording Completion

When RecordingEngine returns a valid RecordedTake:

validate that the session is still active
validate relevant metadata
associate the take with the session
transition to COMPLETED
expose the completed session/take

Do not infer completion from elapsed JavaScript time.

20. Loop Metadata

A completed recording should be representable as a loop-domain result.

Conceptually:

interface Loop {
    id: string;
    take: RecordedTake;

    musicalDuration: MusicalDuration;

    tempo: Tempo;
    timeSignature: TimeSignature;
}

Do not implement playback.

The exact Loop type may remain private or be deferred if it would
unnecessarily expand v0.1.

21. Cancellation

stop() during:

ARMING
COUNTING_IN
RECORDING

must:

cancel scheduled events
cancel RecordingEngine
discard active session state
transition to IDLE

Do not close AudioContext.

If RecordingEngine has no active operation, do not call cancellation
unnecessarily.

Cleanup must be safe if called more than once.

22. Scheduler Integration

Use the existing AudioScheduler API.

Transport should submit events to the scheduler rather than maintaining
its own timer.

Do not duplicate:

scheduler queue
event ordering
lookahead logic
audio-time polling

The AudioScheduler remains responsible for scheduling semantics.

23. Event Ordering

If multiple Transport events occur at exactly the same AudioTime,
define their ordering through the AudioScheduler's deterministic
ordering mechanism.

Do not create a second ordering algorithm inside Transport.

24. Scheduler Events

Transport may need internal event types such as:

CLICK
RECORDING_BOUNDARY
SESSION_COMPLETION

However, the actual recording capture should remain owned by
RecordingEngine.

Do not implement a second recording engine inside Transport.

25. Dependency Failures

If:

MusicalClock
AudioScheduler
RecordingEngine

fails, Transport must:

transition to ERROR or appropriate terminal state
cancel remaining session work
clean up active resources
expose a meaningful error

Do not swallow dependency errors.

26. Session Cancellation Race

Handle the case where:

stop()

occurs while a RecordingEngine completion promise is still pending.

A stale completion must not transition a newly started session to
COMPLETED.

Use a session identifier/generation token or equivalent deterministic
mechanism.

Example:

Session A
    ↓
stop()
    ↓
Session B starts
    ↓
Session A completes asynchronously

Session A's result must be ignored.

This is a critical concurrency invariant.

27. Session Identity

Every active session should have a unique identifier or generation
number.

All asynchronous callbacks must verify that they belong to the current
session before mutating Transport state.

This prevents stale asynchronous results.

28. Public API

The implementation should provide a minimal API conceptually similar
to:

class Transport {
    constructor(...);

    configure(config: TransportConfig): void;

    start(): Promise<void>;

    stop(): Promise<void>;

    getState(): TransportState;

    getPlan(): TransportPlan | null;

    subscribe(listener): Unsubscribe;
}

The exact API should follow repository conventions.

Do not expose unnecessary internal scheduler or recorder objects.

29. Observation

Transport should be observable without depending on DOM APIs.

A minimal callback subscription mechanism is sufficient.

For example:

subscribe(listener): () => void

Listeners should receive state/session changes.

Do not use React-specific state management.

30. Determinism

Given:

same configuration
same sessionStartTime
same Musical Clock
same Scheduler

the Transport plan must be identical.

Specifically:

recordingStartTime
recordingEndTime
recordingWindow
countInEvents

must be deterministic.

31. Unit Test Requirements

Implement tests for:

Configuration
valid 4/4
valid 3/4
valid 6/8
invalid tempo
invalid count-in
invalid recording bars
Planning
zero count-in
one-bar count-in
multi-bar count-in
one-bar recording
multi-bar recording
different tempos
different time signatures
Events
correct number of click events
correct beat indices
correct bar indices
correct accents
monotonically increasing AudioTimes
deterministic event generation
Recording
correct recording window
RecordingEngine receives exact window
recording completion
recording failure
State
valid transitions
invalid transitions
cancellation from ARMING
cancellation from COUNTING_IN
cancellation from RECORDING
completion
Concurrency
stale RecordingEngine completion ignored
stop followed by start
duplicate start rejected
dependency failure during active session
32. Property-Based Tests

Where practical, use fast-check.

Verify:

recordingEndTime > recordingStartTime

and:

all click event times are ordered

and:

same input plan → same generated events

and:

countInBars >= 0 → non-negative count-in duration

and:

recordingBars > 0 → positive recording duration
33. Integration Tests

Use deterministic fakes for:

Musical Clock
Audio Scheduler
Recording Engine

Verify the orchestration:

Transport
    ↓
calculate plan
    ↓
prepare RecordingEngine
    ↓
arm RecordingEngine
    ↓
schedule click events
    ↓
receive RecordedTake
    ↓
COMPLETED

No browser should be required for these tests.

The Recording Engine already owns browser-level microphone integration
testing.

34. No Browser Timing APIs

The Transport package must not contain:

setTimeout
setInterval
Date.now
performance.now
requestAnimationFrame

Use audio-time abstractions exclusively.

35. No Musical Formula Duplication

Do not implement BPM/time-signature duration formulas inside Transport.

If a required calculation is missing from Musical Clock, first evaluate
whether Musical Clock should expose the required public operation.

Do not duplicate the formula in Transport.

36. No PCM Access

Transport must never access:

Float32Array audio samples
channels
audio buffers
PCM data

It may hold a reference to a completed RecordedTake as domain metadata,
but must not manipulate its audio contents.

37. Resource Cleanup

After:

COMPLETED
ERROR
STOP

ensure:

scheduler events are cancelled where appropriate
RecordingEngine is no longer active
session references are released
subscriptions remain valid or are explicitly disposed according to
API semantics

Do not close the shared AudioContext.

38. Performance

Transport should calculate the session plan once.

Avoid:

per-frame computation
high-frequency polling
timer loops
repeated Musical Clock recalculation
unnecessary object creation during execution

The expected workload is small and deterministic.

39. Package Documentation

Create:

packages/transport/README.md

Document:

package purpose
public API
configuration
state machine
session planning
count-in
recording orchestration
scheduler relationship
no-wall-clock-timing rule
cancellation
limitations
future extensions
40. Build and Verification

After implementation run:

npm run typecheck
npm test
npm run build

If the repository uses package-specific scripts, follow existing
workspace conventions.

All tests must pass.

41. Verification Report

After implementation, report:

files created/modified
public Transport API
state machine
session planning model
count-in event model
Musical Clock integration
Audio Scheduler integration
Recording Engine integration
cancellation/concurrency handling
unit-test results
property-test results
integration-test results
typecheck/build results
known limitations

Do not claim tests passed unless they were actually executed.

After the implementation and verification report, stop and wait for
review.

42. Architectural Invariants

The following must always remain true:

Transport never owns the AudioContext.
Transport never closes the AudioContext.
Transport never captures PCM.
Transport never performs DSP.
Transport never uses wall-clock timers for audio timing.
Musical Clock remains authoritative for musical-time mathematics.
Audio Scheduler remains authoritative for audio-time scheduling.
Recording Engine remains authoritative for PCM capture.
Transport plans future events rather than reacting to UI timing.
Stale asynchronous session results cannot mutate a newer session.
Recording windows are half-open [startTime, endTime).
Identical inputs produce deterministic session plans.