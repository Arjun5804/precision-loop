# @precision-loop/musical-clock

A deterministic, pure domain mathematical library for musical time calculations.

## Installation

This is an internal workspace package.

## Quick Start

```typescript
import { MusicalClock } from "@precision-loop/musical-clock";

const clock = new MusicalClock(
  120, // 120 BPM
  { numerator: 4, denominator: 4 }, // 4/4 time signature
  { subdivisionsPerBeat: 4 } // 16th note resolution
);

// Get exact mathematical durations
console.log(clock.beatDurationSeconds); // 0.5
console.log(clock.barDurationSeconds);  // 2.0

// Convert coordinates to seconds (zero-based coordinates!)
// Gets the time for Bar 3 (the 4th bar), Beat 0.
const seconds = clock.positionToSeconds({ bar: 3, beat: 0, subdivision: 0 }); // 6.0 seconds

// Convert exact seconds to nearest sample frame for the Audio Engine
const frames = clock.secondsToFrames(seconds, 48000);
```

## Precision Notes
The `secondsToFrames` conversion uses `Math.round()` to explicitly quantize to the nearest integer sample frame.

## Testing
Run unit and property-based tests via:
```bash
npm run test
```
