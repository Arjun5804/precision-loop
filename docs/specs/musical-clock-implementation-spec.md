# PRECISION LOOP
# MUSICAL CLOCK — IMPLEMENTATION SPECIFICATION v1.0

You are implementing the first foundational package of Precision Loop, a professional browser-based online loop station.

IMPORTANT:
This task is ONLY about the Musical Clock package.

Do NOT implement the full Precision Loop application.
Do NOT implement React.
Do NOT implement Web Audio.
Do NOT implement AudioWorklet.
Do NOT implement microphone recording.
Do NOT implement authentication.
Do NOT implement Supabase.
Do NOT implement APIs.
Do NOT implement AI.
Do NOT implement the studio UI.

Your task is to build a clean, production-quality, deterministic TypeScript library that represents musical time and converts between musical time, seconds, and audio sample frames.

The package will later become a dependency of the Precision Loop audio engine.

==================================================
1. PRIMARY OBJECTIVE
==================================================

Build:

packages/musical-clock/

The package must provide deterministic musical-time calculations based on:

- BPM
- time signature
- bars
- beats
- subdivisions
- seconds
- audio sample frames
- sample rate

The package must be independent of:

- React
- DOM
- Web Audio API
- AudioContext
- AudioWorklet
- browser APIs
- Node-specific runtime APIs
- databases
- network
- external services

It must be usable from browser code, Node-based tests, and future audio-engine packages.

==================================================
2. ARCHITECTURAL PRINCIPLE
==================================================

The Musical Clock is a PURE DOMAIN package.

It represents musical mathematics.

It must NOT be responsible for:

- scheduling audio
- playing clicks
- recording audio
- interacting with microphones
- rendering UI
- maintaining application state
- persistence
- network communication

Those responsibilities belong to other Precision Loop packages.

Keep the package highly cohesive and loosely coupled.

==================================================
3. REPOSITORY CONTEXT
==================================================

The repository is:

precision-loop/

Expected initial structure:

precision-loop/
├── packages/
│   └── musical-clock/
├── docs/
│   └── architecture/
├── tests/
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md

If the repository is empty, initialize the minimal workspace necessary.

Do not create unrelated application code.

==================================================
4. TECHNOLOGY
==================================================

Use:

- TypeScript
- strict TypeScript configuration
- Vitest for testing
- npm workspaces

Use current stable compatible package versions.

Do not introduce unnecessary dependencies.

The runtime library should ideally have ZERO runtime dependencies.

Development dependencies are acceptable for testing/building.

==================================================
5. CORE DOMAIN CONCEPTS
==================================================

Define strongly typed domain concepts for:

Tempo
TimeSignature
MusicalPosition
MusicalDuration
SampleRate
AudioFramePosition

Use clear naming.

Avoid primitive obsession where a small domain type meaningfully improves correctness.

However, do not over-engineer the type system.

==================================================
6. TEMPO
==================================================

Represent tempo as BPM.

V1 supported range:

20 BPM <= BPM <= 400 BPM

Reject:

- zero
- negative BPM
- NaN
- Infinity
- non-finite values
- values outside the supported range

Validation errors must be deterministic and descriptive.

BPM represents quarter-note BPM unless the time-signature model explicitly defines otherwise.

IMPORTANT:
Document the tempo convention clearly.

==================================================
7. TIME SIGNATURE
==================================================

Represent time signature as:

{
  numerator: number,
  denominator: number
}

The denominator represents the note value used by the notated beat.

At minimum support common valid signatures such as:

2/4
3/4
4/4
5/4
6/8
7/8
9/8
12/8

Do not hard-code special logic for only 4/4.

The implementation should mathematically support arbitrary valid positive integer numerator/denominator combinations within reasonable validation limits.

The Musical Clock must remain mathematically neutral regarding musical feel.

Do NOT encode:

- swing
- groove
- accent patterns
- compound-meter feel
- metronome sound patterns

Those belong to the future metronome layer.

==================================================
8. MUSICAL TIME MODEL
==================================================

Clearly define:

- beat
- bar
- subdivision
- musical position

A MusicalPosition should have an unambiguous coordinate convention.

For example, decide whether bars/beats are zero-based or one-based and document it.

Prefer zero-based internal coordinates if that simplifies deterministic calculations, but expose user-facing conversion helpers if needed.

Do NOT mix coordinate conventions.

The package must make illegal positions difficult to represent or clearly validate them.

==================================================
9. MATHEMATICAL MODEL
==================================================

Establish a single authoritative mathematical model.

For a tempo expressed in quarter-note BPM:

quarterNoteDurationSeconds = 60 / BPM

The duration of one notated beat is derived from the time-signature denominator.

For denominator D:

beatDurationSeconds =
quarterNoteDurationSeconds * (4 / D)

Bar duration:

barDurationSeconds =
beatDurationSeconds * numerator

Do not repeatedly accumulate floating-point durations when an absolute calculation can be performed directly.

Prefer calculations based on absolute musical coordinates.

==================================================
10. REQUIRED CALCULATIONS
==================================================

The package must support, at minimum:

- getBeatDuration()
- getBarDuration()
- getSubdivisionDuration()
- barsToSeconds()
- beatsToSeconds()
- secondsToBars()
- secondsToBeats()
- positionToSeconds()
- secondsToPosition()
- secondsToFrames()
- framesToSeconds()

You may design a cleaner API if the semantics remain equivalent.

Document all public APIs.

==================================================
11. SUBDIVISION MODEL
==================================================

Define exactly what a subdivision means.

For V1, use a configurable subdivision resolution rather than assuming one fixed resolution everywhere.

Possible values may include:

- quarter
- eighth
- sixteenth

or an integer subdivisions-per-beat representation.

Choose the model that is most extensible for the future metronome/scheduler.

Do NOT implement metronome behavior here.

The clock only calculates positions and durations.

==================================================
12. PRECISION REQUIREMENTS
==================================================

This package will eventually drive a sample-accurate browser looper.

Therefore precision matters.

Rules:

1. Do not use unnecessary rounding during mathematical calculations.
2. Do not repeatedly accumulate floating-point durations when direct formulas are possible.
3. Preserve fractional seconds internally.
4. Clearly document floating-point limitations.
5. Clearly distinguish mathematical time from integer sample-frame boundaries.
6. Define explicit rounding behavior when conversion to integer frames is requested.
7. Do not silently lose precision.

Where an API returns integer sample frames, document the rounding policy.

Prefer making rounding explicit rather than hiding it.

==================================================
13. SAMPLE FRAME CONVERSION
==================================================

Given:

seconds
sampleRate

Convert between:

seconds ↔ sample frames

Example:

48,000 Hz:

1 second = 48,000 frames

Do not hard-code 48 kHz.

Support arbitrary positive finite sample rates.

Reject invalid sample rates.

Distinguish:

- exact mathematical frame position
- integer sample frame index

Do not pretend fractional sample positions do not exist.

==================================================
14. ROUND-TRIP BEHAVIOR
==================================================

The implementation must document and test:

position
→ seconds
→ position

seconds
→ frames
→ seconds

frames
→ seconds
→ frames

Because integer frame conversion is quantized, define tolerances and expected behavior explicitly.

Do not assert impossible exact equality where quantization makes it mathematically impossible.

==================================================
15. IMMUTABILITY
==================================================

Prefer immutable domain configuration.

Avoid global mutable state.

Avoid singleton clocks.

A clock instance should be independently constructible.

Changing BPM or time signature must have explicit semantics.

Do not silently mutate configuration from helper methods.

==================================================
16. ERROR HANDLING
==================================================

Create a small, meaningful validation/error model.

Errors should identify:

- invalid BPM
- invalid time signature
- invalid numerator
- invalid denominator
- invalid sample rate
- invalid musical position
- invalid duration

Do not create a giant enterprise error hierarchy.

Keep it simple and useful.

==================================================
17. TESTING REQUIREMENTS
==================================================

Create comprehensive deterministic unit tests.

Minimum test categories:

A. BPM

- 60 BPM
- 90 BPM
- 120 BPM
- 140 BPM
- 180 BPM

B. Time signatures

- 2/4
- 3/4
- 4/4
- 5/4
- 6/8
- 7/8
- 9/8
- 12/8

C. Duration calculations

Verify:

120 BPM 4/4:

1 beat = 0.5 seconds
1 bar = 2 seconds
4 bars = 8 seconds

D. Position conversions

Test multiple bars and beats.

E. Round trips

position → seconds → position

seconds → frames → seconds

frames → seconds → frames

F. Validation

Test:

- zero BPM
- negative BPM
- BPM > 400
- NaN
- Infinity
- zero numerator
- negative numerator
- zero denominator
- negative denominator
- invalid sample rate
- NaN sample rate
- Infinity sample rate
- invalid positions

G. Boundary tests

Test:

- first beat
- first bar
- last beat of a bar
- exact bar boundaries
- multiple-bar boundaries

==================================================
18. PROPERTY-STYLE TESTS
==================================================

If practical, introduce property-based testing with fast-check.

Do not add it merely for decoration.

Useful invariants include:

- durations are positive for valid inputs
- bar duration equals beat duration × numerator
- increasing musical position should never decrease absolute time
- N bars should equal N × bar duration
- frame conversion should be monotonic
- valid round trips should remain within documented tolerance

If adding fast-check significantly complicates the package, first implement deterministic tests and then add property tests cleanly.

==================================================
19. PUBLIC API
==================================================

Create a clean public entry point:

packages/musical-clock/src/index.ts

Do not expose internal implementation details unnecessarily.

Consumers should be able to import the package from one stable entry point.

Do not require consumers to import:

src/calculations.ts
src/internal/*
etc.

==================================================
20. CODE QUALITY
==================================================

Use:

- strict TypeScript
- explicit types where they improve clarity
- descriptive naming
- small functions
- pure calculations
- no unnecessary classes
- no unnecessary abstractions
- no any
- no @ts-ignore
- no eslint suppression unless justified
- no magic numbers without named constants
- no dead code
- no placeholder implementations
- no TODOs for core functionality

Avoid "enterprise architecture" for a small mathematical package.

Simple, precise code is preferred.

==================================================
21. DOCUMENTATION
==================================================

Create:

docs/architecture/musical-clock.md

Document:

- purpose
- scope
- non-scope
- terminology
- coordinate conventions
- tempo model
- time-signature model
- mathematical formulas
- precision strategy
- frame conversion
- rounding policy
- public API
- examples
- testing strategy
- known limitations
- future extension points

Also create:

docs/architecture/adr/001-musical-clock-as-pure-domain-package.md

Explain why the Musical Clock is isolated from:

- Web Audio
- UI
- persistence
- networking
- application state

==================================================
22. README
==================================================

Create:

packages/musical-clock/README.md

Include:

- what it does
- installation/workspace usage
- quick example
- API overview
- supported concepts
- precision notes
- testing command

==================================================
23. BUILD VALIDATION
==================================================

Before considering the task complete, run:

- TypeScript typecheck
- all unit tests
- package build if a build step exists

There must be zero TypeScript errors.

There must be zero failing tests.

Do not claim success without actually running the checks.

==================================================
24. SELF-REVIEW
==================================================

After implementation, perform a self-review against this specification.

Specifically check:

1. Did you accidentally introduce browser dependencies?
2. Did you accidentally introduce Web Audio dependencies?
3. Is there any global mutable state?
4. Are time-signature calculations generalized?
5. Is floating-point precision handled intentionally?
6. Is integer frame rounding explicitly defined?
7. Are coordinate conventions consistent?
8. Are boundary conditions tested?
9. Are public APIs documented?
10. Is the package genuinely reusable by the future audio engine?

If any answer is no, fix the implementation before reporting completion.

==================================================
25. DO NOT EXPAND SCOPE
==================================================

Do not build:

- metronome
- scheduler
- recorder
- audio engine
- DSP
- UI
- React
- authentication
- database
- cloud sync
- AI
- export
- project management

Those will be separate implementation phases.

==================================================
26. FINAL RESPONSE FORMAT
==================================================

When finished, report:

1. Files created/modified
2. Public API
3. Mathematical model used
4. Coordinate convention
5. Frame rounding policy
6. Tests implemented
7. Typecheck result
8. Test result
9. Build result
10. Any architectural decisions made
11. Any assumptions that require review

Do NOT claim production readiness for the entire Precision Loop project.

Only report readiness of the Musical Clock package.