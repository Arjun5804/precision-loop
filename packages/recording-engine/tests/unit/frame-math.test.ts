import { describe, it, expect } from 'vitest';
import { timeToFrame } from '../../src/utils/frame-math';

describe('frame-math', () => {
    it('should convert time to exact frame count', () => {
        expect(timeToFrame(2, 48000)).toBe(96000);
        expect(timeToFrame(6, 48000)).toBe(288000);
    });

    it('should handle non-integer audio-time conversion', () => {
        expect(timeToFrame(1.00000001, 48000)).toBe(48000);
        expect(timeToFrame(1.5, 48000)).toBe(72000);
    });
});
