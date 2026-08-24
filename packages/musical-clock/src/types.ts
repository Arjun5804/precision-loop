/**
 * Represents the tempo in Quarter Note Beats Per Minute.
 */
export type Tempo = number;

/**
 * Represents a musical time signature.
 */
export interface TimeSignature {
  /** The number of beats in a bar. Must be > 0. */
  readonly numerator: number;
  /** The note value representing one beat (e.g., 4 for quarter note). Must be > 0. */
  readonly denominator: number;
}

/**
 * Represents an absolute coordinate in musical time.
 * All coordinates are zero-based (e.g., bar 0 is the first bar).
 */
export interface MusicalPosition {
  /** The zero-based bar number. */
  readonly bar: number;
  /** The zero-based beat number within the bar. */
  readonly beat: number;
  /**
   * The zero-based subdivision within the beat.
   * Its resolution depends on the configured subdivisionsPerBeat.
   */
  readonly subdivision: number;
}

/**
 * Configuration for how subdivisions are represented.
 */
export interface SubdivisionsConfig {
  /**
   * The number of subdivisions within a single notated beat.
   * Must be > 0. For example, 4 in a 4/4 time signature means 16th notes.
   */
  readonly subdivisionsPerBeat: number;
}
