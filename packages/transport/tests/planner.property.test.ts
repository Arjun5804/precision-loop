import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { planSession } from '../src/planner';
import { MusicalClock } from '@precision-loop/musical-clock';
import type { TransportConfig } from '../src/types';

describe('Transport Planner Property Tests', () => {
  it('generates valid and deterministic session plans', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 300 }), // tempo
        fc.integer({ min: 1, max: 12 }),   // numerator
        fc.constantFrom(2, 4, 8, 16),      // denominator
        fc.integer({ min: 0, max: 8 }),    // countInBars
        fc.integer({ min: 1, max: 16 }),   // recordingBars
        fc.double({ min: 0, max: 3600, noNaN: true, noDefaultInfinity: true }),  // sessionStartTime
        (tempo, num, den, countIn, recBars, startTime) => {
          
          const config: TransportConfig = {
            tempo,
            timeSignature: { numerator: num, denominator: den },
            countInBars: countIn,
            recordingBars: recBars,
          };
          
          const clock = new MusicalClock(tempo, config.timeSignature, { subdivisionsPerBeat: 4 });
          
          const plan1 = planSession(config, clock, startTime);
          const plan2 = planSession(config, clock, startTime);

          // 1. Determinism
          expect(plan1).toEqual(plan2);

          // 2. Invariants
          expect(plan1.recordingEndTime).toBeGreaterThan(plan1.recordingStartTime);
          
          const expectedRecDuration = clock.barsToSeconds(recBars);
          // Allow tiny floating point differences
          expect(Math.abs((plan1.recordingEndTime - plan1.recordingStartTime) - expectedRecDuration)).toBeLessThan(0.0001);

          // 3. Click ordering
          for (let i = 1; i < plan1.countInEvents.length; i++) {
            expect(plan1.countInEvents[i].audioTime).toBeGreaterThan(plan1.countInEvents[i-1].audioTime);
          }
          
          // 4. Correct number of clicks
          expect(plan1.countInEvents.length).toBe(countIn * num);
        }
      )
    );
  });
});
