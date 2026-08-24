import { Tempo, TimeSignature, MusicalPosition, SubdivisionsConfig } from "./types.js";

export class MusicalClockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MusicalClockError";
  }
}

export class InvalidTempoError extends MusicalClockError {
  constructor(bpm: number) {
    super(`Invalid tempo: ${bpm} BPM. Must be between 20 and 400.`);
    this.name = "InvalidTempoError";
  }
}

export class InvalidTimeSignatureError extends MusicalClockError {
  constructor(numerator: number, denominator: number) {
    super(`Invalid time signature: ${numerator}/${denominator}. Both must be positive integers.`);
    this.name = "InvalidTimeSignatureError";
  }
}

export class InvalidSampleRateError extends MusicalClockError {
  constructor(sampleRate: number) {
    super(`Invalid sample rate: ${sampleRate}. Must be a positive finite number.`);
    this.name = "InvalidSampleRateError";
  }
}

export class InvalidFrameError extends MusicalClockError {
  constructor(frames: number) {
    super(`Invalid frame position: ${frames}. Must be a non-negative finite integer.`);
    this.name = "InvalidFrameError";
  }
}

export class InvalidPositionError extends MusicalClockError {
  constructor(pos: Partial<MusicalPosition>, reason: string) {
    super(`Invalid musical position (${pos.bar}:${pos.beat}:${pos.subdivision}): ${reason}`);
    this.name = "InvalidPositionError";
  }
}

export function validateTempo(tempo: Tempo): void {
  if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo < 20 || tempo > 400) {
    throw new InvalidTempoError(tempo);
  }
}

export function validateTimeSignature(signature: TimeSignature): void {
  if (
    !Number.isInteger(signature.numerator) ||
    signature.numerator <= 0 ||
    !Number.isInteger(signature.denominator) ||
    signature.denominator <= 0
  ) {
    throw new InvalidTimeSignatureError(signature.numerator, signature.denominator);
  }
}

export function validateSampleRate(sampleRate: number): void {
  if (typeof sampleRate !== "number" || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new InvalidSampleRateError(sampleRate);
  }
}

export function validateFrames(frames: number): void {
  if (typeof frames !== "number" || !Number.isInteger(frames) || frames < 0) {
    throw new InvalidFrameError(frames);
  }
}

export function validateSubdivisionsConfig(config: SubdivisionsConfig): void {
  if (!Number.isInteger(config.subdivisionsPerBeat) || config.subdivisionsPerBeat <= 0) {
    throw new MusicalClockError(`Invalid subdivisions per beat: ${config.subdivisionsPerBeat}`);
  }
}
