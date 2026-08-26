import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordingEngine } from '../../src/RecordingEngine';
import { InvalidWindowError, InvalidStateError, FinalizationFailureError } from '../../src/errors';

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
        vi.stubGlobal('navigator', {
            mediaDevices: {
                getUserMedia: vi.fn().mockResolvedValue({
                    getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }])
                })
            }
        });

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
        
        await expect(p).rejects.toThrow(FinalizationFailureError);
    });

    it('should allow prepare() again after successful recording completion', async () => {
        // 1. Prepare and arm
        await engine.prepare('fake-url');
        (engine as any).workletNode = { arm: vi.fn(), cancel: vi.fn(), disconnect: vi.fn() };
        const p = engine.arm({ startTime: 11, endTime: 12 });
        
        // 2. Complete the recording
        const handleMsg = (engine as any).handleWorkletMessage.bind(engine);
        const fakeBuffer = new ArrayBuffer(4 * 48000); // exactly 1 second of frames at 48kHz
        handleMsg({ type: 'CHUNK', buffer: fakeBuffer, frameCount: 48000 });
        handleMsg({ type: 'COMPLETED' });
        
        await p;
        expect(engine.state).toBe('IDLE');
        
        // 3. Prepare again (regression test)
        await expect(engine.prepare('fake-url-2')).resolves.not.toThrow();
        expect(engine.state).toBe('READY');
    });

    it('should handle cancellation during PREPARING gracefully', async () => {
        let resolveGetUserMedia: (stream: any) => void;
        vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValueOnce(new Promise(resolve => {
            resolveGetUserMedia = resolve;
        }));

        const preparePromise = engine.prepare('fake-url');
        
        // Wait until getUserMedia is actually invoked
        await new Promise(r => setTimeout(r, 0));
        
        expect(engine.state).toBe('PREPARING');
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();

        // Cancel while waiting for getUserMedia
        engine.cancel();
        expect(engine.state).toBe('IDLE');

        // Now resolve getUserMedia
        const stopMock = vi.fn();
        resolveGetUserMedia!({ getTracks: () => [{ stop: stopMock }] });

        await preparePromise; // Should resolve safely without changing state

        expect(engine.state).toBe('IDLE'); // Not READY
        expect(stopMock).toHaveBeenCalled(); // Should clean up acquired media stream

        // Subsequent prepare should work
        vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce({
            getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }])
        } as any);
        await expect(engine.prepare('fake-url-2')).resolves.not.toThrow();
        expect(engine.state).toBe('READY');
    });

    it('should throw if module fails to load', async () => {
        mockContext.audioWorklet.addModule.mockRejectedValueOnce(new Error('Network error'));
        await expect(engine.prepare('fake-url')).rejects.toThrow('Network error');
    });
});
