# Loop Model Implementation Specification

## Overview
This specification details the implementation of the `@precision-loop/loop-model` package.

## Types and Interfaces

### `MusicalLength`
```typescript
interface MusicalLength {
  bars: number;
}
```

### `Take`
Domain representation of a raw audio asset.
- `id`: string
- `sampleRate`: number
- `channelCount`: number
- `frameCount`: number
- `channels`: readonly Float32Array[]
- `sourceStartTime`?: number
- `sourceEndTime`?: number

### `Loop`
Immutable-by-contract usage of a `Take` within a `Track`.
- `id`: string
- `take`: Take
- `musicalLength`: MusicalLength

### `Track`
Timeline container for loops.
- `id`: string
- `getVolume()`, `setVolume()`
- `getPan()`, `setPan()`: [-1.0, 1.0]
- `getMuted()`, `setMuted()`
- `getSoloed()`, `setSoloed()`
- `getLoop()`, `setLoop(loop)`, `removeLoop()`

### `Session`
Root container and ID factory.
- `id`: string
- `getTempo()`, `setTempo()`
- `getTimeSignature()`, `setTimeSignature()`
- `getTracks()`, `removeTrack(id)`
- Factory methods: `createTrack()`, `createTake()`, `createLoop()`

## Core Invariants
- `Take` PCM channels must match `frameCount`.
- `Take` `sampleRate > 0`, `channelCount > 0`, `frameCount > 0`.
- `Track` pan is constrained to `[-1.0, 1.0]`.
- `Session` tempo and time signature CANNOT change if any `Track` contains a `Loop`.
- Factory methods in `Session` ensure deterministic and unique IDs within the session.
