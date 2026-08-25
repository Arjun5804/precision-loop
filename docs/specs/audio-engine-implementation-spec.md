# Precision Loop — Web Audio Foundation / Audio Engine v0.1
# Implementation Specification

**Version:** 0.1
**Status:** Implementation specification
**Depends on:** `@precision-loop/audio-scheduler`

---

# 1. Objective

Implement the foundational browser audio runtime for Precision Loop.

The package is responsible for:

- AudioContext lifecycle
- audio runtime information
- root audio graph creation
- audio device discovery
- output-device capability handling
- AudioWorklet infrastructure
- integration boundaries for the Audio Scheduler

This package is NOT the recording engine, looper, mixer, DSP engine, or UI.

---

# 2. Architectural Position

```text
Musical Clock
      ↓
Audio Scheduler
      ↓
Web Audio Runtime
      ↓
AudioContext
      ↓
Audio Graph
      ↓
Output

The Audio Engine provides the browser-specific implementation boundary.

3. Scope
Included
AudioContext creation
explicit asynchronous initialization
AudioContext lifecycle
runtime state
sample rate exposure
base latency exposure
output latency exposure where available
root graph
master gain
device enumeration
input/output device categorization
devicechange handling
output-device capability detection
AudioWorklet module loading
minimal foundation AudioWorklet processor
Audio Scheduler time-source integration boundary
deterministic tests for non-browser logic
browser integration test strategy/documentation
Excluded
microphone recording
loop recording
playback engine
metronome
effects
EQ
compressor
reverb
waveform rendering
mixing
exporting
persistence
authentication
React UI
application state
cloud/networking
4. Package

Create:

packages/audio-engine/

Package name:

@precision-loop/audio-engine

Runtime dependencies should remain minimal.

It may depend on:

@precision-loop/audio-scheduler

Do not introduce a third-party audio engine unless explicitly justified.

5. AudioContext Ownership

One AudioEngine instance owns one AudioContext.

Do not create AudioContexts throughout the application.

AudioContext creation must happen during explicit initialization.

The constructor must remain lightweight.

Conceptually:

const engine = new AudioEngine();

await engine.initialize();
6. Initialization

Initialization must be asynchronous.

It should:

create the AudioContext
inspect runtime properties
create the root graph
initialize required AudioWorklet infrastructure
establish internal state
expose readiness

If initialization fails, expose a meaningful domain error.

Do not leave the engine partially initialized without a defined state.

7. AudioContext State

Represent lifecycle clearly.

Possible conceptual states:

uninitialized
initializing
suspended
running
closed
error

Do not duplicate native AudioContext state unnecessarily.

Use a wrapper state only where it provides lifecycle clarity.

8. Resume / Suspend / Close

Expose:

resume()
suspend()
close()

All should be asynchronous where the underlying Web Audio API requires it.

resume() must call the underlying AudioContext resume operation.

suspend() must call the underlying suspend operation.

close() must release the audio context and prevent further use.

Do not automatically resume audio without an explicit application request.

Do not create timers to poll AudioContext state.

9. Browser Autoplay Policy

Assume the AudioContext may begin suspended.

Do not attempt to bypass browser autoplay policy.

The UI/application layer will eventually call resume() in response to an appropriate user gesture.

The engine should expose the current state so the UI can communicate this clearly.

10. Sample Rate

Never assume a fixed sample rate.

Expose:

sampleRate: number

from the actual AudioContext.

The runtime sample rate is authoritative.

Do not hard-code:

44100
48000

as assumptions.

The sample rate must eventually be available to recording/frame-based components.

11. Latency

Expose:

baseLatency: number
outputLatency: number | null

or an equivalent capability-aware representation.

baseLatency should reflect the AudioContext value.

outputLatency may not be available in all supported environments.

Do not invent fallback latency numbers.

Do not describe these values as end-to-end microphone-to-headphone latency.

12. Audio Graph

Create a minimal root graph:

AudioContext
     │
     ▼
Master Gain
     │
     ▼
Destination

The master gain is the central output control point.

Do not add effects or mixers yet.

The graph should be constructed deterministically during initialization.

13. Graph Ownership

AudioEngine owns the root graph nodes.

Future track/transport components may connect into the master bus.

They must not directly manage the AudioContext destination.

This keeps output routing centralized.

14. Audio Device Discovery

Provide a device abstraction that distinguishes:

audioinput
audiooutput

Use navigator.mediaDevices.enumerateDevices() when available.

Do not expose raw browser device objects unnecessarily.

Expose stable application-level device information.

Device labels may be unavailable until the browser grants appropriate permissions.

Do not assume labels are always present.

15. Device Permissions

Do not automatically request microphone permission merely to initialize the AudioEngine.

Initialization should not unexpectedly trigger a permission prompt.

Microphone permission will be requested explicitly when the application starts an input/recording workflow.

16. Device Changes

Listen for devicechange where supported.

When devices change:

re-enumerate devices
update the internal device snapshot
notify consumers through a controlled mechanism

Do not automatically destroy/recreate AudioContext.

Do not automatically switch the user's selected device unless explicitly required.

17. Output Device Selection

Support output-device selection only when the browser provides the required capability.

Conceptually:

setOutputDevice(deviceId: string): Promise<void>

If the capability is unavailable:

report a clear unsupported-feature result/error
preserve normal default output behavior

Do not break playback merely because custom output selection is unavailable.

Do not assume AudioContext.setSinkId exists in every browser.

18. Secure Context

Document that AudioWorklet and relevant device/output APIs may require secure contexts.

Production deployment must use HTTPS.

Local development should work through localhost browser security rules.

19. AudioWorklet Infrastructure

Initialize the AudioWorklet infrastructure during AudioEngine initialization if feasible.

Load a minimal foundation processor.

The processor should do no meaningful DSP.

Its purpose is to verify:

worklet module loading
processor registration
AudioWorkletNode creation
graph connection
lifecycle cleanup

Do not implement recording inside the processor.

20. AudioWorklet Processor

The foundation processor must not assume a fixed render quantum size.

Inspect the actual input/output buffer lengths supplied to process().

Do not hard-code 128 frames as a permanent invariant.

The processor should remain computationally trivial.

21. AudioWorklet Communication

Do not stream individual audio samples through MessagePort.

For V0.1, only establish the infrastructure necessary to prove the node can be created and communicated with if needed.

Future recording data transport will be designed separately.

22. Audio Scheduler Integration

Provide an adapter/boundary so the Audio Scheduler can eventually obtain:

AudioContext.currentTime

as its AudioTimeSource.

Conceptually:

AudioContext.currentTime
        ↓
AudioTimeSource
        ↓
AudioScheduler

Do not duplicate scheduler logic.

Do not modify the Audio Scheduler package's core architecture.

23. Audio Event Sink Integration

Provide an architectural boundary for future implementation of:

AudioEventSink

against the Web Audio runtime.

V0.1 does not need to implement all audio event types.

Do not implement recording or metronome events yet.

24. Error Handling

Use a small domain error model.

Potential errors:

AudioEngineError
AudioContextInitializationError
AudioContextStateError
AudioDeviceError
AudioWorkletInitializationError
UnsupportedAudioFeatureError

Do not create a large error hierarchy.

Errors should preserve useful underlying causes where appropriate.

25. Testing

Separate tests into:

Deterministic unit tests

Test:

state transitions
configuration validation
device classification
capability detection
graph construction decisions
error mapping

Use mocks/fakes for browser APIs.

Browser integration tests

The implementation must document a strategy for verifying:

AudioContext creation
AudioContext resume/suspend
AudioWorklet loading
AudioWorkletNode creation
graph connectivity
device enumeration
device change handling

Do not claim Node unit tests prove real Web Audio behavior.

26. Testability

Browser globals must not be scattered throughout the domain logic.

Prefer small adapters around:

AudioContext
navigator.mediaDevices
AudioWorklet

This allows deterministic testing.

Do not create a giant browser mock framework.

27. Public API

Expose a small facade.

Consumers should be able to:

initialize
resume
suspend
close
inspect state
inspect sample rate
inspect latency information
enumerate devices
observe device changes
select output device when supported

Do not expose internal AudioNodes unless future architecture requires it.

Do not expose raw AudioContext as the default public API.

28. Resource Cleanup

close() must:

disconnect owned nodes where appropriate
remove event listeners
terminate/disable worklet-related resources where appropriate
close the AudioContext
transition to closed state

Calling close more than once should be deterministic and safe.

29. No Timers

AudioEngine v0.1 must not own:

setInterval
setTimeout
requestAnimationFrame

The Audio Scheduler remains manually driven.

A future scheduler driver will own recurring scheduling.

30. No React

Do not import React or UI-specific code.

The package is infrastructure only.

31. No Recording

Do not call:

getUserMedia()

automatically during initialization.

Do not create a recorder.

Microphone acquisition belongs to the future recording subsystem.

32. No Effects

Do not implement:

EQ
compressor
distortion
delay
reverb
noise gate

Those belong to future DSP/effects packages.

33. Suggested Structure

A reasonable structure:

packages/audio-engine/
├── src/
│ ├── index.ts
│ ├── audio-engine.ts
│ ├── audio-context.ts
│ ├── audio-devices.ts
│ ├── audio-graph.ts
│ ├── capabilities.ts
│ ├── errors.ts
│ └── types.ts
│
├── worklets/
│ └── foundation-processor.ts
│
├── tests/
│ ├── audio-engine.test.ts
│ ├── capabilities.test.ts
│ ├── devices.test.ts
│ └── graph.test.ts
│
├── package.json
├── tsconfig.json
└── README.md

This is guidance rather than a rigid requirement.

34. Documentation

Create:

docs/architecture/audio-engine.md

Document:

AudioContext ownership
lifecycle
sample rate
latency
graph
device management
output selection
AudioWorklet
Scheduler integration
browser security requirements
testing boundaries
future recording architecture

Create:

docs/architecture/adr/003-web-audio-runtime-boundary.md

Explain why browser-specific Web Audio behavior is isolated behind the Audio Engine boundary.

35. Package README

Document:

purpose
architecture
initialization
lifecycle
capabilities
device discovery
limitations
testing
future integration
36. Verification

Run:

npm test
npm run typecheck
npm run build

All must pass.

Do not claim browser-level functionality is verified by Node tests alone.

37. Scope Protection

Do NOT implement:

recorder
looper
metronome
mixer
effects
waveform
export
React
persistence
authentication
AI
cloud synchronization

This task is ONLY Web Audio Foundation v0.1.

38. Final Review

Before completion verify:

Exactly one AudioContext is owned per AudioEngine instance.
Constructor is lightweight.
Initialization is explicit and asynchronous.
AudioContext may remain suspended until resume().
Sample rate comes from the real context.
Latency values are capability-aware.
Root graph is minimal.
Device enumeration does not unexpectedly request microphone permission.
Device changes are handled safely.
Output-device selection gracefully handles unsupported browsers.
AudioWorklet infrastructure loads successfully where supported.
Processor does not assume a fixed block size.
No timers exist in the package.
No React/browser UI exists in the package.
No recording exists yet.
Scheduler integration uses AudioContext.currentTime rather than duplicating clocks.
Resources are cleaned up by close().
Public API is small.
Unit tests are deterministic.
Browser-only behavior is clearly separated from testable logic.
39. Final Report

Report:

Files created/modified
Public API
AudioContext lifecycle
Graph topology
Device architecture
Output-device capability behavior
AudioWorklet architecture
Scheduler integration
Error handling
Tests
Typecheck result
Build result
Browser integration limitations
Remaining limitations

Only claim readiness for Web Audio Foundation v0.1.