import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('recording-processor', () => {
    let ProcessorClass: any;
    let postMessageMock: any;
    let processor: any;

    beforeEach(async () => {
        postMessageMock = vi.fn();
        
        const globalAny = global as any;
        globalAny.AudioWorkletProcessor = class {
            port = { postMessage: postMessageMock };
        };
        globalAny.registerProcessor = (name: string, ctor: any) => {
            ProcessorClass = ctor;
        };
        globalAny.currentFrame = 0;

        // Dynamic import to ensure globals are set first
        await import('../../src/worklet/recording-processor' + '?bust=' + Date.now());
        
        processor = new ProcessorClass();
        // Give it an onmessage handler internally
    });

    const createInput = (startVal: number, length: number) => {
        const arr = new Float32Array(length);
        for(let i=0; i<length; i++) arr[i] = startVal + i;
        return [[arr]];
    };

    it('should ignore data before startFrame', () => {
        processor.port.onmessage({ data: { type: 'ARM', startFrame: 128, endFrame: 256 } });
        
        (global as any).currentFrame = 0;
        processor.process(createInput(0, 128), [], {});
        
        expect(postMessageMock).not.toHaveBeenCalled();
    });

    it('should capture partial start block', () => {
        processor.port.onmessage({ data: { type: 'ARM', startFrame: 100, endFrame: 256 } });
        
        (global as any).currentFrame = 0;
        processor.process(createInput(0, 128), [], {}); // frames 0..127
        
        expect(postMessageMock).toHaveBeenCalledTimes(1);
        const msg = postMessageMock.mock.calls[0][0];
        expect(msg.type).toBe('CHUNK');
        expect(msg.frameCount).toBe(28); // 128 - 100 = 28
    });

    it('should capture exact frame count across multiple blocks and send COMPLETED', () => {
        processor.port.onmessage({ data: { type: 'ARM', startFrame: 0, endFrame: 200 } });
        
        (global as any).currentFrame = 0;
        processor.process(createInput(0, 128), [], {}); // frames 0..127
        expect(postMessageMock).toHaveBeenCalledTimes(1);
        
        (global as any).currentFrame = 128;
        processor.process(createInput(128, 128), [], {}); // frames 128..255
        
        // Should have posted the remaining 72 frames (200 - 128 = 72)
        expect(postMessageMock).toHaveBeenCalledTimes(3); 
        expect(postMessageMock.mock.calls[1][0].type).toBe('CHUNK');
        expect(postMessageMock.mock.calls[1][0].frameCount).toBe(72);
        
        expect(postMessageMock.mock.calls[2][0].type).toBe('COMPLETED');
    });

    it('should handle cancellation', () => {
        processor.port.onmessage({ data: { type: 'ARM', startFrame: 0, endFrame: 1000 } });
        
        (global as any).currentFrame = 0;
        processor.process(createInput(0, 128), [], {});
        expect(postMessageMock).toHaveBeenCalledTimes(1);
        
        processor.port.onmessage({ data: { type: 'CANCEL' } });
        
        (global as any).currentFrame = 128;
        processor.process(createInput(128, 128), [], {});
        
        // No more messages after cancel
        expect(postMessageMock).toHaveBeenCalledTimes(1);
    });
});
