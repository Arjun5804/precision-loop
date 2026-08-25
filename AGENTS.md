# Precision Loop — Agent Instructions

## Project

Precision Loop is a professional browser-based online loop station.

The long-term product goal is to provide:

- highly accurate musical timing
- automatic count-in
- automatic recording boundaries
- synchronized multitrack looping
- low-latency browser audio
- non-destructive effects
- local-first operation
- cloud persistence
- optional AI-assisted musical analysis

However, the current development task is intentionally much smaller.

---

# Current Task

## Musical Clock v0.1

Implement only the foundational Musical Clock domain package.

Do NOT implement the rest of Precision Loop.

The current task is limited to deterministic musical-time calculations.

---

# Core Architectural Principle

The Musical Clock is a pure domain package.

It must have ZERO dependency on:

- React
- DOM
- Web Audio API
- AudioContext
- AudioWorklet
- MediaDevices
- browser APIs
- databases
- Supabase
- FastAPI
- network services
- authentication
- AI services

The package must be usable from:

- browser application code
- Node-based tests
- future audio-engine packages
- future worker/audio-processing contexts

---

# Current Repository Scope

The current implementation should establish:

```text
precision-loop/
├── packages/
│   └── musical-clock/
├── docs/
│   └── architecture/
├── tests/
├── package.json
├── tsconfig.json
└── AGENTS.md


---

# Current Development Phase

The Musical Clock v0.1 has been completed and verified.

The current development target is:

## Audio Scheduler v0.1

Implementation specification:

`docs/specs/audio-scheduler-implementation-spec.md`

The Audio Scheduler must remain strictly separated from:

- Web Audio
- AudioContext
- AudioWorklet
- microphone I/O
- recording
- playback
- DSP
- UI
- persistence
- networking

The Scheduler Core is manually driven through `tick()`.

It must NOT own:

- setInterval
- setTimeout
- requestAnimationFrame
- Worker loops
- AudioContext lifecycle

A future Scheduler Driver will own recurring invocation.

The Scheduler Core must use abstractions for:

- audio time source
- audio event sink

so it can be tested deterministically without a browser or real audio hardware.

Do not implement the Web Audio adapter during Audio Scheduler v0.1.

# Current Development Phase

Musical Clock v0.1: COMPLETE
Audio Scheduler v0.1: COMPLETE
CI: ACTIVE

Current target:

## Web Audio Foundation / Audio Engine v0.1

Specification:

`docs/specs/audio-engine-implementation-spec.md`

The Audio Engine is the browser-specific Web Audio boundary.

It owns:

- AudioContext lifecycle
- root audio graph
- audio runtime information
- device discovery
- output-device capability handling
- AudioWorklet infrastructure

It does NOT own:

- recording
- looping
- metronome
- effects
- mixing
- exporting
- React UI
- persistence

Important constraints:

1. One AudioContext per AudioEngine instance.
2. AudioContext creation is explicit and asynchronous.
3. Do not assume 44.1 kHz or 48 kHz.
4. Do not automatically request microphone permission during initialization.
5. Do not assume custom output-device selection is universally supported.
6. Do not create timers in the Audio Engine.
7. Do not duplicate Audio Scheduler timing logic.
8. The Scheduler's AudioTimeSource will eventually use AudioContext.currentTime.
9. AudioWorklet may be initialized for infrastructure verification, but recording/DSP is out of scope.
10. Do not hard-code a 128-frame AudioWorklet render quantum.
11. Keep browser-specific APIs behind small adapters for deterministic testing.
12. Do not expose raw AudioContext or internal AudioNodes as the default public API.