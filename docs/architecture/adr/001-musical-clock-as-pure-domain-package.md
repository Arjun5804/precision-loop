# ADR 001: Musical Clock as Pure Domain Package

## Context
Precision Loop requires a high-performance, sample-accurate audio engine capable of looping synchronized musical events. The core calculations (durations, bars, frames) need to be reliable and highly testable.

## Decision
We implement the `musical-clock` package as a Pure Domain Package, entirely isolated from Web Audio, React, the DOM, Node.js, and any stateful execution engines.

## Rationale
- **Testability**: Pure functions and immutable objects can be tested deterministically without browser mocks.
- **Portability**: This exact same mathematical model can be used by the main UI thread (React) for visual representation, the worker threads (AudioWorklet) for low-latency scheduling, and a Node backend if necessary.
- **Separation of Concerns**: Calculating "when" a bar happens is fundamentally a separate concern from actually scheduling an audio buffer.

## Consequences
- The clock cannot "play" sounds.
- The clock does not have a `setInterval` or `requestAnimationFrame`.
- The clock relies completely on explicit inputs (tempo, time signature, config, elapsed seconds) to generate coordinate data.
