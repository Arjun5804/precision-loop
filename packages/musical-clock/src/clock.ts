import { Tempo, TimeSignature, MusicalPosition, SubdivisionsConfig } from "./types.js";
import {
  getBeatDuration,
  getBarDuration,
  getSubdivisionDuration,
  barsToSeconds,
  beatsToSeconds,
  secondsToBars,
  secondsToBeats,
  positionToSeconds,
  secondsToPosition,
  secondsToFrames,
  framesToSeconds
} from "./calculations.js";

/**
 * An immutable, ergonomic wrapper around the pure musical time calculations.
 * It holds the Tempo, TimeSignature, and SubdivisionsConfig configuration,
 * but maintains NO mutable state.
 */
export class MusicalClock {
  public readonly tempo: Tempo;
  public readonly timeSignature: TimeSignature;
  public readonly config: SubdivisionsConfig;

  constructor(tempo: Tempo, timeSignature: TimeSignature, config: SubdivisionsConfig) {
    this.tempo = tempo;
    this.timeSignature = { ...timeSignature }; // Immutable copy
    this.config = { ...config };
  }

  get beatDurationSeconds(): number {
    return getBeatDuration(this.tempo, this.timeSignature);
  }

  get barDurationSeconds(): number {
    return getBarDuration(this.tempo, this.timeSignature);
  }

  get subdivisionDurationSeconds(): number {
    return getSubdivisionDuration(this.tempo, this.timeSignature, this.config);
  }

  barsToSeconds(bars: number): number {
    return barsToSeconds(bars, this.tempo, this.timeSignature);
  }

  beatsToSeconds(beats: number): number {
    return beatsToSeconds(beats, this.tempo, this.timeSignature);
  }

  secondsToBars(seconds: number): number {
    return secondsToBars(seconds, this.tempo, this.timeSignature);
  }

  secondsToBeats(seconds: number): number {
    return secondsToBeats(seconds, this.tempo, this.timeSignature);
  }

  positionToSeconds(position: MusicalPosition): number {
    return positionToSeconds(position, this.tempo, this.timeSignature, this.config);
  }

  secondsToPosition(seconds: number): MusicalPosition {
    return secondsToPosition(seconds, this.tempo, this.timeSignature, this.config);
  }

  secondsToFrames(seconds: number, sampleRate: number): number {
    return secondsToFrames(seconds, sampleRate);
  }

  framesToSeconds(frames: number, sampleRate: number): number {
    return framesToSeconds(frames, sampleRate);
  }

  /**
   * Returns a new MusicalClock instance with a modified tempo.
   */
  withTempo(newTempo: Tempo): MusicalClock {
    return new MusicalClock(newTempo, this.timeSignature, this.config);
  }

  /**
   * Returns a new MusicalClock instance with a modified time signature.
   */
  withTimeSignature(newTimeSignature: TimeSignature): MusicalClock {
    return new MusicalClock(this.tempo, newTimeSignature, this.config);
  }
}
