import { Tempo, TimeSignature, MusicalPosition, SubdivisionsConfig } from "./types.js";
import { validateTempo, validateTimeSignature, validateSampleRate, validateSubdivisionsConfig, InvalidPositionError } from "./validation.js";

/**
 * Returns the duration of a single notated beat in seconds.
 * 
 * In standard notation, a tempo is usually in Quarter Notes per minute.
 * If the time signature denominator is 4 (quarter note), 1 beat = 1 quarter note.
 * For denominator D: beatDuration = quarterNoteDuration * (4 / D)
 */
export function getBeatDuration(tempo: Tempo, timeSignature: TimeSignature): number {
  validateTempo(tempo);
  validateTimeSignature(timeSignature);
  
  const quarterNoteDurationSeconds = 60.0 / tempo;
  return quarterNoteDurationSeconds * (4.0 / timeSignature.denominator);
}

/**
 * Returns the duration of a single bar in seconds.
 */
export function getBarDuration(tempo: Tempo, timeSignature: TimeSignature): number {
  return getBeatDuration(tempo, timeSignature) * timeSignature.numerator;
}

/**
 * Returns the duration of a single subdivision in seconds.
 */
export function getSubdivisionDuration(
  tempo: Tempo, 
  timeSignature: TimeSignature, 
  config: SubdivisionsConfig
): number {
  validateSubdivisionsConfig(config);
  return getBeatDuration(tempo, timeSignature) / config.subdivisionsPerBeat;
}

/**
 * Converts a number of bars to seconds.
 */
export function barsToSeconds(bars: number, tempo: Tempo, timeSignature: TimeSignature): number {
  return bars * getBarDuration(tempo, timeSignature);
}

/**
 * Converts a number of beats to seconds.
 */
export function beatsToSeconds(beats: number, tempo: Tempo, timeSignature: TimeSignature): number {
  return beats * getBeatDuration(tempo, timeSignature);
}

/**
 * Converts seconds to a fractional number of bars.
 */
export function secondsToBars(seconds: number, tempo: Tempo, timeSignature: TimeSignature): number {
  return seconds / getBarDuration(tempo, timeSignature);
}

/**
 * Converts seconds to a fractional number of beats.
 */
export function secondsToBeats(seconds: number, tempo: Tempo, timeSignature: TimeSignature): number {
  return seconds / getBeatDuration(tempo, timeSignature);
}

/**
 * Converts a zero-based MusicalPosition to exact mathematical seconds.
 */
export function positionToSeconds(
  position: MusicalPosition,
  tempo: Tempo,
  timeSignature: TimeSignature,
  config: SubdivisionsConfig
): number {
  if (position.bar < 0 || position.beat < 0 || position.subdivision < 0) {
    throw new InvalidPositionError(position, "Coordinates cannot be negative.");
  }
  
  if (position.beat >= timeSignature.numerator) {
    throw new InvalidPositionError(position, `Beat must be less than numerator (${timeSignature.numerator}).`);
  }
  
  if (position.subdivision >= config.subdivisionsPerBeat) {
    throw new InvalidPositionError(position, `Subdivision must be less than subdivisionsPerBeat (${config.subdivisionsPerBeat}).`);
  }

  const barTime = barsToSeconds(position.bar, tempo, timeSignature);
  const beatTime = beatsToSeconds(position.beat, tempo, timeSignature);
  const subTime = position.subdivision * getSubdivisionDuration(tempo, timeSignature, config);

  return barTime + beatTime + subTime;
}

/**
 * Converts exact mathematical seconds to a zero-based MusicalPosition.
 * Uses strict coordinate constraints.
 */
export function secondsToPosition(
  seconds: number,
  tempo: Tempo,
  timeSignature: TimeSignature,
  config: SubdivisionsConfig
): MusicalPosition {
  if (seconds < 0) {
    throw new Error("Seconds cannot be negative.");
  }
  
  const subDur = getSubdivisionDuration(tempo, timeSignature, config);
  const EPSILON = 1e-9;
  
  const totalSubdivisions = Math.floor((seconds + EPSILON) / subDur);
  const subsPerBar = config.subdivisionsPerBeat * timeSignature.numerator;
  
  const bar = Math.floor(totalSubdivisions / subsPerBar);
  const remainingSubs = totalSubdivisions % subsPerBar;
  
  const beat = Math.floor(remainingSubs / config.subdivisionsPerBeat);
  const subdivision = remainingSubs % config.subdivisionsPerBeat;

  return { bar, beat, subdivision };
}

/**
 * Converts exact mathematical seconds to integer sample frames using Math.round().
 * This provides the nearest-frame quantization for a given sample rate.
 * The audio engine is responsible for boundary logic; this is purely mathematical rounding.
 */
export function secondsToFrames(seconds: number, sampleRate: number): number {
  validateSampleRate(sampleRate);
  return Math.round(seconds * sampleRate);
}

/**
 * Converts integer sample frames back to exact mathematical seconds.
 */
export function framesToSeconds(frames: number, sampleRate: number): number {
  validateSampleRate(sampleRate);
  return frames / sampleRate;
}
