# Musical Clock v0.1 Architecture

The Musical Clock is a pure domain mathematical package for Precision Loop. It calculates musical time dynamically, detached from any actual scheduler or AudioContext.

## Mathematical Semantics

### Tempo Convention
Tempo is defined strictly in **Quarter Note Beats Per Minute (BPM)**. 
- 120 BPM means 120 quarter notes per minute.
- E.g., if the time signature is 6/8, the denominator represents an eighth note beat. The duration of an eighth note is calculated relative to the quarter note BPM.
- BPM must be finite, between 20 and 400.

### Time Signature Interpretation
Represented as a numerator and denominator:
- `numerator`: The number of beats in a bar.
- `denominator`: The note value of the notated beat (e.g., 4 = quarter note, 8 = eighth note).
We do not hard-code 4/4. Durations scale algorithmically according to the ratio `4 / denominator`.

### Coordinate Conventions
All internal and exposed structural coordinates (`bar`, `beat`, `subdivision`) are strictly **zero-based**.
- `bar: 0` is the first bar.
- `beat: 0` is the first beat of the bar.
- `subdivision: 0` is the first subdivision of the beat.
This ensures deterministic math without "+1 / -1" scattered throughout the codebase.

### SubdivisionsPerBeat
Subdivisions represent the lowest resolution of a single beat. 
- E.g., `subdivisionsPerBeat: 4` in a 4/4 signature represents 16th notes.
- This is purely an integer subdivision of mathematical time and does NOT encode swing, groove, accent patterns, or metronome sounds.

### Time Conversions
We can convert between arbitrary coordinates and mathematical seconds. Mathematical seconds use pure floating-point arithmetic.
- `quarterNoteDuration = 60 / BPM`
- `beatDuration = quarterNoteDuration * (4 / denominator)`

### Rounding Policy and Frame Conversion
When converting exact mathematical seconds into integer sample frames, we use explicit rounding:
- `frames = Math.round(seconds * sampleRate)`
This guarantees the nearest frame quantization. Any boundary adjustments for loops or recordings must be applied by the future audio engine, not by this package.
