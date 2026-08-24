# Precision Loop — Audio Scheduler v0.1
# Implementation Specification

**Version:** 0.1  
**Status:** Implementation specification  
**Depends on:** `@precision-loop/musical-clock`

---

# 1. Objective

Implement the foundational `audio-scheduler` package for Precision Loop.

The Audio Scheduler is responsible for determining which musical/audio events should be submitted to an audio timeline during a scheduling tick.

It must provide deterministic scheduling behavior while remaining independent of:

- React
- DOM
- UI
- microphone input
- audio recording
- DSP
- Web Audio implementation details
- persistence
- networking
- authentication
- AI

The scheduler will eventually become the timing bridge between the Musical Clock and the Web Audio audio engine.

---

# 2. Architectural Position

The intended architecture is:

```text
                    Musical Clock
                         │
                         │ musical timing
                         ▼
                 ┌───────────────┐
                 │ Scheduler Core│
                 │               │
                 │    tick()     │
                 └───────┬───────┘
                         │
                         │ scheduled events
                         ▼
                  AudioEventSink
                         │
                ┌────────┴────────┐
                ▼                 ▼
            Test Sink       WebAudio Sink
                                  │
                                  ▼
                           AudioContext

A separate scheduler driver will eventually call:

scheduler.tick()

The Scheduler Core itself does NOT own a recurring timer in V0.1.

3. Critical Architectural Principle

Separate:

musical-time calculation
scheduling decisions
time source
event execution/submission
recurring scheduling driver

These must not be combined into one class.

The intended conceptual interfaces are:

MusicalClock
AudioTimeSource
AudioEventSink
AudioScheduler
SchedulerDriver

The exact TypeScript API may differ if a cleaner design is found, but the separation of responsibilities must remain.

4. Scope
Included

V0.1 includes:

scheduled event representation
event IDs
absolute audio timestamps
event queue
deterministic ordering
scheduling window
lookahead
cancellation
scheduler state
audio time source abstraction
audio event sink abstraction
deterministic tick()
test/fake implementations
validation
unit tests
property-based tests where useful
documentation
Explicitly excluded

Do NOT implement:

Web Audio API integration
AudioContext
AudioBufferSourceNode
microphone access
recording
playback
metronome synthesis
DSP
effects
transport UI
React
IndexedDB
Supabase
authentication
network APIs
AI
tempo maps
tempo automation
seeking
loop management
multitrack management

The scheduler must not grow into an audio engine.

5. Package

Create:

packages/audio-scheduler/

It should be a workspace package:

@precision-loop/audio-scheduler

It must depend on:

@precision-loop/musical-clock

It must have no other runtime dependencies.

6. Audio Time

Audio time is represented as seconds.

Use:

type AudioTime = number;

or an equivalent branded/strong type if it genuinely improves correctness.

Audio time must be:

finite
non-negative where required
represented in seconds
independent of wall-clock time

Do NOT use:

Date.now()
performance.now()
setTimeout timestamp

as the authoritative audio timeline.

7. AudioTimeSource

Define an abstraction conceptually equivalent to:

interface AudioTimeSource {
    currentTime(): number;
}

The scheduler obtains its current audio time from this abstraction.

V0.1 must include a deterministic fake implementation for tests.

The future production implementation may use:

AudioContext.currentTime

but that adapter is OUT OF SCOPE for V0.1.

8. AudioEventSink

Define an abstraction conceptually equivalent to:

interface AudioEventSink {
    schedule(event: ScheduledEvent): void;
}

The Scheduler submits events to this sink.

V0.1 must include a deterministic test sink that records submitted events.

Do NOT implement a Web Audio sink yet.

9. Scheduled Event

Every scheduled event must contain at minimum:

id
time
type
payload

Conceptually:

interface ScheduledEvent<TPayload = unknown> {
    id: string;
    time: AudioTime;
    type: string;
    payload: TPayload;
}

Requirements:

ID must be stable
time must be finite
time must not be negative
event type must be non-empty
payload should remain opaque to the scheduler

The scheduler does not interpret event payloads.

10. Event IDs

Event IDs must uniquely identify scheduled events within the scheduler's domain.

IDs are required because future functionality will need:

cancel(eventId)

The scheduler must not rely on object identity for cancellation.

Do not invent a complex UUID system unless necessary.

A caller-provided stable ID is acceptable.

11. Event Queue

The scheduler needs a deterministic event queue.

The queue must support:

add(event)
remove(eventId)
removeAll()
peek()
getEventsInWindow()

The exact API can differ.

The queue must:

maintain deterministic ordering
prevent duplicate event IDs
support cancellation
return events chronologically
behave predictably at equal timestamps
12. Duplicate IDs

Duplicate event IDs must not silently overwrite an existing event.

Choose and document one explicit behavior.

Preferred:

adding a duplicate ID throws a validation/domain error

Do not silently replace an event.

13. Event Ordering

Events must be ordered by:

absolute audio time
deterministic priority/order
insertion sequence where required

At minimum, two events with different timestamps must always be returned chronologically.

For events with identical timestamps, behavior must be deterministic.

Do not depend on incidental JavaScript object ordering.

14. Event Priority

V0.1 should support deterministic ordering for equal timestamps.

However, do not create a large event-priority hierarchy prematurely.

A simple deterministic mechanism is sufficient.

For example:

timestamp
    ↓
priority
    ↓
insertion sequence

If priority is not necessary for the initial event types, insertion sequence may be sufficient.

Document the decision.

15. Lookahead

The scheduler operates using a lookahead window.

Example:

currentTime = 10.000
lookahead = 0.100

window:
10.000 → 10.100

Events within the window are eligible for scheduling.

Default:

lookahead = 0.100 seconds

This is an initial engineering default, NOT a guarantee of audio accuracy.

The value must be configurable.

16. Scheduler Interval

V0.1 MUST NOT own a recurring scheduling timer.

Do not implement:

setInterval(...)
setTimeout(...)

inside the Scheduler Core.

A future Scheduler Driver will decide how frequently:

scheduler.tick()

is called.

An initial future driver may use approximately:

25 ms

as its interval.

This is outside V0.1.

17. Why Scheduler Core Has No Timer

The separation is intentional:

Scheduler Driver
       │
       │ calls
       ▼
Scheduler.tick()

This allows:

deterministic testing
easier simulation
future Worker-based drivers
different driver strategies
application-controlled lifecycle
separation of timing policy from scheduling logic

Do not merge these responsibilities.

18. Scheduler State

V0.1 supports only:

STOPPED
RUNNING

The exact enum/type naming is implementation-defined.

Do NOT implement:

PAUSED
SEEKING
RECORDING
PLAYING
COUNTING_IN

Those are future transport/application concepts.

19. Starting the Scheduler

The scheduler should have explicit lifecycle behavior.

Conceptually:

start()
stop()
tick()

Starting should reset/initialize scheduling state according to the documented semantics.

Stopping should prevent future scheduling from occurring.

Do not introduce hidden automatic timers.

20. Tick Semantics

tick() is the core operation.

Conceptually:

currentTime = audioTimeSource.currentTime()

windowEnd = currentTime + lookahead

find all unscheduled events where:

event.time >= currentTime
AND
event.time <= windowEnd

submit each event to AudioEventSink

mark them as scheduled

However, events exactly at or slightly before the current time require explicit semantics.

The implementation must define and test boundary behavior.

21. Late Events

A scheduler can be ticked after an event's intended time.

Example:

currentTime = 10.050

event.time = 10.000

V0.1 must define what happens.

Preferred behavior:

the scheduler must NOT submit an event with a timestamp already behind the current audio time
the event should be classified as late/missed
the scheduler should not silently move the event to a new time

Choose a clear mechanism for representing or reporting late events.

Do not automatically reschedule late events.

The exact API may be:

TickResult

containing:

scheduled events
late events
current time
window end

or another clean equivalent.

22. Boundary at Current Time

Events exactly at:

event.time === currentTime

must have defined behavior.

Preferred:

event.time >= currentTime

is eligible.

Floating-point comparisons must be handled intentionally.

Do not introduce arbitrary tolerances without justification.

23. Boundary at Window End

Events exactly at:

event.time === currentTime + lookahead

should be eligible.

Therefore the scheduling window is:

[currentTime, currentTime + lookahead]

with an inclusive upper bound.

Document and test this behavior.

24. Already-Scheduled Events

An event must never be submitted more than once.

Once an event has been successfully submitted to the sink, it must not be submitted again on subsequent ticks.

Example:

tick 1:
schedule event A

tick 2:
event A must NOT be scheduled again

This is a core invariant.

25. Cancellation

Provide:

cancel(eventId)

and:

cancelAll()

Cancelled events must not be submitted.

If an event has already been submitted to the sink, cancellation from the Scheduler does not imply that an external audio system can undo it.

This distinction must be documented.

V0.1 cancellation only applies to events that have not yet been submitted.

26. Cancellation Semantics

If:

event A

is cancelled before its scheduling window is reached:

event A must never reach the sink

If it has already been submitted:

cancel()

must not pretend that the underlying audio event has been unscheduled.

Return a meaningful result if useful.

Do not implement Web Audio cancellation in this package.

27. Scheduler Tick Result

The scheduler should expose enough information for deterministic testing and future integration.

A useful conceptual result:

interface TickResult {
    currentTime: number;
    windowEnd: number;
    scheduled: ScheduledEvent[];
    late: ScheduledEvent[];
}

The implementation may use a different API if it is cleaner.

Do not expose internal queue structures unnecessarily.

28. Scheduler and Musical Clock

The Audio Scheduler may depend on the Musical Clock package for musical-to-audio conversions.

However, the scheduler itself should primarily operate on absolute audio times.

For V0.1, avoid building a giant abstraction that automatically converts every event from musical positions.

The scheduler can accept already-resolved audio events.

Future higher-level components can use:

MusicalClock
    ↓
musical position
    ↓
absolute audio time
    ↓
Scheduler

This keeps V0.1 focused.

29. Important Architectural Boundary

Do NOT make the Scheduler responsible for:

BPM
time signature
bars
beats
subdivisions

Those belong to Musical Clock / higher-level transport logic.

The Scheduler cares about:

absolute audio time

This is intentional.

30. Testing Architecture

The package must be testable without:

browser
AudioContext
microphone
speakers
real-time timers

Use:

FakeAudioTimeSource
TestAudioEventSink

or equivalent test doubles.

Tests should control time explicitly.

31. Deterministic Test Example

Example:

currentTime = 10.000
lookahead = 0.100

Events:

9.999
10.000
10.050
10.100
10.101

Expected:

10.000 → scheduled
10.050 → scheduled
10.100 → scheduled

while:

9.999 → late
10.101 → remains pending

The exact late-event behavior must be represented consistently.

32. Multiple Ticks

Test:

tick at 10.000
tick at 10.025
tick at 10.050
tick at 10.075

Ensure:

no duplicate submissions
events are eventually scheduled
events outside the window remain pending
event order remains deterministic
33. Cancellation Tests

Test:

schedule A
cancel A
tick

A must not reach the sink.

Also test:

schedule A
tick
cancel A

A was already submitted and therefore cancellation must not claim to undo the sink submission.

34. Ordering Tests

Test events:

A @ 2.0
B @ 1.0
C @ 2.0
D @ 1.0

Verify deterministic ordering.

Equal timestamps must not produce nondeterministic results.

35. Validation Tests

Test invalid:

negative audio time
NaN audio time
Infinity audio time
negative lookahead
zero lookahead if prohibited
NaN lookahead
Infinity lookahead
empty event IDs
duplicate event IDs
empty event type
invalid scheduler state transitions

Do not over-validate opaque payloads.

36. Property-Based Testing

Use fast-check only where it provides meaningful coverage.

Useful invariants:

Chronological ordering

For all returned scheduled events:

event[i].time <= event[i + 1].time
No duplicate scheduling

An event ID should appear at most once in sink submissions.

Window correctness

Every newly scheduled event should satisfy:

currentTime <= event.time <= windowEnd
Cancellation

Cancelled pending events should never appear in sink output.

Determinism

Same queue + same current time + same configuration should produce the same result.

Do not create artificial properties just to increase test count.

37. Precision

Do not round audio timestamps during scheduling.

If an event is:

10.123456789

preserve that value.

The Scheduler should not convert audio time to integer samples.

Sample-frame conversion belongs to the future audio engine where required.

38. No setInterval

This is a hard requirement.

Do NOT implement:

setInterval(...)

or:

setTimeout(...)

inside AudioScheduler.

The scheduler is manually driven through:

tick()
39. No Web Audio

Do NOT import:

AudioContext
AudioNode
AudioBuffer
AudioBufferSourceNode
GainNode

in this package.

The future Web Audio adapter belongs elsewhere.

40. Package API

Expose a clean public API through:

packages/audio-scheduler/src/index.ts

Consumers should not import internal modules directly.

The public API should expose only the domain abstractions necessary for integration.

41. Error Handling

Use a small domain error model.

Potential errors:

InvalidAudioTimeError
InvalidLookaheadError
InvalidEventError
DuplicateEventIdError
InvalidSchedulerStateError

Do not create a giant error hierarchy.

Errors must be deterministic and descriptive.

42. Code Quality

Use:

strict TypeScript
no any
no @ts-ignore
no unexplained magic numbers
pure functions where possible
small focused modules
explicit interfaces
descriptive names
no dead code
no unnecessary abstractions
no speculative future systems
43. Suggested File Structure

A reasonable structure is:

packages/audio-scheduler/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── scheduler.ts
│   ├── event-queue.ts
│   ├── timeline.ts
│   └── validation.ts
│
├── tests/
│   ├── scheduler.test.ts
│   ├── event-queue.test.ts
│   ├── timeline.test.ts
│   └── property.test.ts
│
├── package.json
├── tsconfig.json
└── README.md

This is guidance, not a requirement.

If a simpler structure is demonstrably better, prefer the simpler structure.

44. Documentation

Create:

docs/architecture/audio-scheduler.md

Document:

architecture
responsibilities
non-responsibilities
event lifecycle
queue semantics
lookahead
tick semantics
late events
cancellation
time source
sink abstraction
ordering
testing strategy
future Web Audio integration

Also create:

docs/architecture/adr/002-audio-scheduler-separation.md

Explain why:

Scheduler Core

is separated from:

Scheduler Driver

and:

Web Audio Adapter
45. Package README

Create:

packages/audio-scheduler/README.md

Include:

purpose
architecture
quick example
public API
testing
non-goals
future integration
46. Build and Verification

Before reporting completion:

Run:

npm ci
npm test
npm run typecheck
npm run build

or the repository's equivalent commands.

All must pass.

Do not claim success without actually executing them.

47. Self-Review

Before finishing, verify:

Is the Scheduler Core independent of Web Audio?
Is it independent of React/browser APIs?
Does it avoid timers?
Is tick() deterministic?
Can time be controlled in tests?
Can events be cancelled before submission?
Can an event be submitted more than once?
Are equal timestamps deterministic?
Are current-time and lookahead boundaries documented?
Are late events handled explicitly?
Is audio timestamp precision preserved?
Is Musical Clock reused rather than duplicated?
Is the package free of unnecessary runtime dependencies?
Is the public API small and coherent?

Fix issues before reporting completion.

48. Scope Protection

Do not implement the following even if they seem useful:

metronome
recorder
playback engine
AudioContext adapter
Web Audio nodes
DSP
effects
transport UI
React components
project state
persistence
authentication
cloud synchronization
AI
tempo automation
seeking
multitrack logic

This task is ONLY Audio Scheduler v0.1.

49. Final Report

When complete, report:

Files created/modified
Public API
Event lifecycle
Tick semantics
Lookahead policy
Late-event policy
Cancellation semantics
Equal-timestamp ordering policy
Time-source abstraction
Sink abstraction
Tests implemented
Typecheck result
Build result
Any architectural decisions
Any remaining limitations

Do not claim the entire Precision Loop audio system is production-ready.

Only report readiness of Audio Scheduler v0.1.