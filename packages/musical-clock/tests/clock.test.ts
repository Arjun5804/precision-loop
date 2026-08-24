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

  describe("Position Conversions", () => {
    it("converts position to seconds in 120 BPM 4/4", () => {
      // 1 bar = 2.0s, 1 beat = 0.5s, 1 sub (1/4 beat) = 0.125s
      // pos (bar 1, beat 1, sub 2) = 2.0 + 0.5 + 0.25 = 2.75s
      const sec = positionToSeconds({ bar: 1, beat: 1, subdivision: 2 }, 120, ts44, conf16);
      expect(sec).toBe(2.75);
    });

    it("converts seconds to position in 120 BPM 4/4", () => {
      const pos = secondsToPosition(2.75, 120, ts44, conf16);
      expect(pos).toEqual({ bar: 1, beat: 1, subdivision: 2 });
    });

    it("boundary test: multiple bars exactly", () => {
      const sec = positionToSeconds({ bar: 4, beat: 0, subdivision: 0 }, 120, ts44, conf16);
      expect(sec).toBe(8.0);
      
      const pos = secondsToPosition(8.0, 120, ts44, conf16);
      expect(pos).toEqual({ bar: 4, beat: 0, subdivision: 0 });
    });
  });

  describe("Frame Conversions", () => {
    it("converts seconds to frames (rounding)", () => {
      // 1.5 seconds at 48000 Hz = 72000
      expect(secondsToFrames(1.5, 48000)).toBe(72000);
      
      // Quantization: nearest integer
      expect(secondsToFrames(1.00001, 48000)).toBe(48000);
    });

    it("converts frames to seconds", () => {
      expect(framesToSeconds(72000, 48000)).toBe(1.5);
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
