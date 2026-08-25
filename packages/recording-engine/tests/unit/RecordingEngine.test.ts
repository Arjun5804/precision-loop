import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordingEngine } from '../../src/RecordingEngine';
import { InvalidWindowError, InvalidStateError } from '../../src/errors';

describe('RecordingEngine', () => {
    let mockContext: any;
    let engine: RecordingEngine;

    beforeEach(() => {
        mockContext = {
            sampleRate: 48000,
            currentTime: 10,
            createMediaStreamSource: vi.fn().mockReturnValue({ connect: vi.fn(), disconnect: vi.fn() }),
            createGain: vi.fn().mockReturnValue({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
            destination: {},
            audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) }
        };
        engine = new RecordingEngine(mockContext as unknown as AudioContext);
    });

    it('should start in IDLE state', () => {
        expect(engine.state).toBe('IDLE');
    });

    it('should reject arm if startFrame is in the past', async () => {
        engine['_state'] = 'READY'; // Force state for test
        await expect(engine.arm({ startTime: 5, endTime: 6 })).rejects.toThrow(InvalidWindowError);
    });
    
    it('should reject arm if state is IDLE', async () => {
        await expect(engine.arm({ startTime: 15, endTime: 16 })).rejects.toThrow(InvalidStateError);
    });
});
