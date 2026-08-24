import { describe, it } from "vitest";
import fc from "fast-check";
import { secondsToPosition, positionToSeconds, getBarDuration, secondsToFrames, framesToSeconds } from "../src/calculations.js";

describe("Musical Clock Properties", () => {
  const tsArbitrary = fc.record({
    numerator: fc.integer({ min: 1, max: 32 }),
    denominator: fc.constantFrom(2, 4, 8, 16)
  });
  
  const tempoArbitrary = fc.double({ min: 20, max: 400, noNaN: true });
  const subConfigArbitrary = fc.record({
    subdivisionsPerBeat: fc.integer({ min: 1, max: 16 })
  });

  it("increasing musical position should not decrease absolute time", () => {
    fc.assert(
      fc.property(
        tempoArbitrary,
        tsArbitrary,
        subConfigArbitrary,
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (tempo, ts, config, s1, s2) => {
          const t1 = s1 * 0.1;
          const t2 = (s1 + s2) * 0.1;
          
          const pos1 = secondsToPosition(t1, tempo, ts, config);
          const pos2 = secondsToPosition(t2, tempo, ts, config);
          
          const calc1 = positionToSeconds(pos1, tempo, ts, config);
          const calc2 = positionToSeconds(pos2, tempo, ts, config);
          
          // calc2 should be >= calc1 since t2 >= t1 (with a small epsilon for float precision)
          return calc2 >= calc1 - 1e-9;
        }
      )
    );
  });

  it("position -> seconds -> position round trip", () => {
    fc.assert(
      fc.property(
        tempoArbitrary,
        tsArbitrary,
        subConfigArbitrary,
        fc.integer({ min: 0, max: 100 }), // bar
        fc.integer({ min: 0, max: 31 }),  // beat (we'll mod by numerator)
        fc.integer({ min: 0, max: 15 }),  // sub (we'll mod by subPerBeat)
        (tempo, ts, config, bar, rawBeat, rawSub) => {
          const pos = {
            bar,
            beat: rawBeat % ts.numerator,
            subdivision: rawSub % config.subdivisionsPerBeat
          };
          
          const seconds = positionToSeconds(pos, tempo, ts, config);
          const resultPos = secondsToPosition(seconds, tempo, ts, config);
          
          return pos.bar === resultPos.bar && 
                 pos.beat === resultPos.beat && 
                 pos.subdivision === resultPos.subdivision;
        }
      )
    );
  });
  
  it("frames -> seconds -> frames is stable", () => {
    fc.assert(
        fc.property(
            fc.integer({ min: 0, max: 100000000 }),
            fc.constantFrom(44100, 48000, 96000),
            (frames, sampleRate) => {
                const seconds = framesToSeconds(frames, sampleRate);
                const calcFrames = secondsToFrames(seconds, sampleRate);
                
                return frames === calcFrames;
            }
        )
    );
  });
});
