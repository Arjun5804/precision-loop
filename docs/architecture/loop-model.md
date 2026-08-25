# Loop Model Architecture

## Purpose
The `@precision-loop/loop-model` package provides the pure product domain model for the application. It gives raw captured audio musical meaning by organizing them into Sessions, Tracks, and Loops.

## Boundaries
- **No Infrastructure Dependencies:** This package depends ONLY on `@precision-loop/musical-clock` for `Tempo` and `TimeSignature` types.
- **No Browser APIs:** It does not use Web Audio, `AudioContext`, or the DOM.
- **No Persistence:** v0.1 is strictly in-memory.

## Core Concepts
- **Session:** The root container and factory for all domain objects. Enforces ID uniqueness and tempo/time signature invariants.
- **Track:** A container for at most one Loop in v0.1. Owns playback parameters (volume, pan, mute, solo).
- **Loop:** The immutable-by-contract musical usage of a `Take` with a defined musical length.
- **Take:** The domain representation of a raw audio asset, owning PCM buffers through an explicit transfer model.

## Invariants
- PCM buffers are transferred without copying and are immutable-by-contract.
- Session tempo and time signature cannot be changed while any Loop exists in the Session.
- Domain object IDs are session-scoped and deterministic.
