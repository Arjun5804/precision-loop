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