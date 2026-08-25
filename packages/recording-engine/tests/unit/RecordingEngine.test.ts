import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordingEngine } from '../../src/RecordingEngine';
import { InvalidWindowError, InvalidStateError, IncompleteTakeError } from '../../src/errors';

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

    it('should reject arm if startFrame is too close (no lookahead)', async () => {
        engine['_state'] = 'READY'; // Force state for test
        await expect(engine.arm({ startTime: 10.01, endTime: 11 })).rejects.toThrow(InvalidWindowError);
    });
    
    it('should reject arm if state is IDLE', async () => {
        await expect(engine.arm({ startTime: 15, endTime: 16 })).rejects.toThrow(InvalidStateError);
    });

    it('should handle finalization frame invariant', async () => {
        engine['_state'] = 'READY';
        (engine as any).workletNode = { arm: vi.fn(), cancel: vi.fn(), disconnect: vi.fn() };
        const p = engine.arm({ startTime: 11, endTime: 12 }); // 1 sec = 48000 frames
        
        // Mock worklet message
        const handleMsg = (engine as any).handleWorkletMessage.bind(engine);
        
        // Provide wrong number of frames
        const fakeBuffer = new ArrayBuffer(4 * 40000); // 40000 frames
        handleMsg({ type: 'CHUNK', buffer: fakeBuffer, frameCount: 40000 });
        handleMsg({ type: 'COMPLETED' });
        
        await expect(p).rejects.toThrow(IncompleteTakeError);
    });

    it('should throw if module fails to load', async () => {
        mockContext.audioWorklet.addModule.mockRejectedValueOnce(new Error('Network error'));
        await expect(engine.prepare('fake-url')).rejects.toThrow('Network error');
    });
});
