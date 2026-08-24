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