import { describe, it, expect } from "vitest";
import { getBeatDuration, getBarDuration, positionToSeconds, secondsToPosition, secondsToFrames, framesToSeconds } from "../src/calculations.js";
import { validateTempo, InvalidTempoError } from "../src/validation.js";
import { MusicalClock } from "../src/clock.js";

describe("Musical Clock calculations", () => {
  const ts44 = { numerator: 4, denominator: 4 };
  const ts34 = { numerator: 3, denominator: 4 };
  const ts68 = { numerator: 6, denominator: 8 };
  const conf16 = { subdivisionsPerBeat: 4 };

  describe("Tempo validation", () => {
    it("should accept valid tempos", () => {
      expect(() => validateTempo(120)).not.toThrow();
      expect(() => validateTempo(20)).not.toThrow();
      expect(() => validateTempo(400)).not.toThrow();
    });

    it("should reject invalid tempos", () => {
      expect(() => validateTempo(0)).toThrow(InvalidTempoError);
      expect(() => validateTempo(-10)).toThrow(InvalidTempoError);
      expect(() => validateTempo(500)).toThrow(InvalidTempoError);
      expect(() => validateTempo(NaN)).toThrow(InvalidTempoError);
    });
  });

  describe("Durations", () => {
    it("120 BPM 4/4 should have 0.5s beats and 2s bars", () => {
      expect(getBeatDuration(120, ts44)).toBe(0.5);
      expect(getBarDuration(120, ts44)).toBe(2.0);
    });

    it("120 BPM 6/8 should have 0.25s beats and 1.5s bars", () => {
      // 120 quarter notes per minute. 6/8 denominator is 8 (eighth note beat).
      // beatDuration = (60/120) * (4/8) = 0.5 * 0.5 = 0.25
      expect(getBeatDuration(120, ts68)).toBe(0.25);
      expect(getBarDuration(120, ts68)).toBe(1.5);
    });
  });

  describe("Position Conversions (Grid Boundaries & Quantization)", () => {
    const EPSILON = 1e-9;
    const subDur = 0.125; // in 120 BPM 4/4 with subPerBeat=4
    const beatDur = 0.5;
    const barDur = 2.0;

    it("exact subdivision boundary", () => {
      // Bar 0, Beat 0, Sub 1 = 0.125s
      const sec = 0.125;
      expect(secondsToPosition(sec, 120, ts44, conf16)).toEqual({ bar: 0, beat: 0, subdivision: 1 });
    });

    it("just before subdivision boundary", () => {
      // 0.125 - small_amount (but > EPSILON) should quantize down to Sub 0
      const sec = 0.125 - EPSILON * 2;
      expect(secondsToPosition(sec, 120, ts44, conf16)).toEqual({ bar: 0, beat: 0, subdivision: 0 });
    });

    it("just after subdivision boundary", () => {
      const sec = 0.125 + EPSILON * 2;
      expect(secondsToPosition(sec, 120, ts44, conf16)).toEqual({ bar: 0, beat: 0, subdivision: 1 });
    });

    it("exact beat boundary", () => {
      // Bar 0, Beat 1, Sub 0 = 0.5s
      expect(secondsToPosition(beatDur, 120, ts44, conf16)).toEqual({ bar: 0, beat: 1, subdivision: 0 });
    });

    it("just before beat boundary", () => {
      // 0.5 - small_amount should be Bar 0, Beat 0, Sub 3
      expect(secondsToPosition(beatDur - EPSILON * 2, 120, ts44, conf16)).toEqual({ bar: 0, beat: 0, subdivision: 3 });
    });

    it("just after beat boundary", () => {
      expect(secondsToPosition(beatDur + EPSILON * 2, 120, ts44, conf16)).toEqual({ bar: 0, beat: 1, subdivision: 0 });
    });

    it("exact bar boundary", () => {
      // Bar 1, Beat 0, Sub 0 = 2.0s
      expect(secondsToPosition(barDur, 120, ts44, conf16)).toEqual({ bar: 1, beat: 0, subdivision: 0 });
    });

    it("just before bar boundary", () => {
      // 2.0 - small_amount should be Bar 0, Beat 3, Sub 3
      expect(secondsToPosition(barDur - EPSILON * 2, 120, ts44, conf16)).toEqual({ bar: 0, beat: 3, subdivision: 3 });
    });

    it("just after bar boundary", () => {
      expect(secondsToPosition(barDur + EPSILON * 2, 120, ts44, conf16)).toEqual({ bar: 1, beat: 0, subdivision: 0 });
    });

    it("demonstrates position -> seconds -> position is an exact round trip", () => {
      const pos = { bar: 3, beat: 2, subdivision: 1 };
      const seconds = positionToSeconds(pos, 120, ts44, conf16);
      const returnedPos = secondsToPosition(seconds, 120, ts44, conf16);
      expect(returnedPos).toEqual(pos);
    });

    it("demonstrates arbitrary seconds -> position -> seconds quantizes (does not return original seconds)", () => {
      const arbitrarySeconds = 1.05; // Somewhere between 1.0 (Beat 2, Sub 0) and 1.125 (Beat 2, Sub 1)
      const pos = secondsToPosition(arbitrarySeconds, 120, ts44, conf16);
      expect(pos).toEqual({ bar: 0, beat: 2, subdivision: 0 });
      
      const quantizedSeconds = positionToSeconds(pos, 120, ts44, conf16);
      expect(quantizedSeconds).toBe(1.0); // Floored to the grid
      expect(quantizedSeconds).not.toBe(arbitrarySeconds);
    });
  });

  describe("Frame Conversions and Validation", () => {
    it("converts seconds to frames (rounding)", () => {
      expect(secondsToFrames(1.5, 48000)).toBe(72000);
      expect(secondsToFrames(1.00001, 48000)).toBe(48000); // nearest integer
    });

    it("converts frames to seconds", () => {
      expect(framesToSeconds(72000, 48000)).toBe(1.5);
    });

    it("rejects invalid frame inputs", () => {
      expect(() => framesToSeconds(-10, 48000)).toThrow(); // negative
      expect(() => framesToSeconds(10.5, 48000)).toThrow(); // fractional
      expect(() => framesToSeconds(NaN, 48000)).toThrow(); // NaN
      expect(() => framesToSeconds(Infinity, 48000)).toThrow(); // Infinity
    });
  });

  describe("MusicalClock class", () => {
    it("should be immutable when updating tempo", () => {
      const clock = new MusicalClock(120, ts44, conf16);
      const newClock = clock.withTempo(140);
      
      expect(clock.tempo).toBe(120);
      expect(newClock.tempo).toBe(140);
      expect(newClock.timeSignature).toEqual(ts44);
    });
  });
});
