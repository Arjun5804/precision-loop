"use strict";
class RecordingProcessor extends AudioWorkletProcessor {
    startFrame = null;
    endFrame = null;
    active = false;
    constructor() {
        super();
        this.port.onmessage = (event) => {
            const msg = event.data;
            if (msg.type === 'ARM') {
                this.startFrame = msg.startFrame;
                this.endFrame = msg.endFrame;
                this.active = true;
            }
            else if (msg.type === 'FINALIZE') {
                console.log('DEBUG [recording-processor]: Received FINALIZE', 'endFrame', msg.endFrame);
                this.endFrame = msg.endFrame;
            }
            else if (msg.type === 'CANCEL') {
                this.active = false;
                this.startFrame = null;
                this.endFrame = null;
            }
        };
    }
    process(inputs, outputs, parameters) {
        if (!this.active || this.startFrame === null || this.endFrame === null) {
            return true; // Keep processing silently
        }
        const channelData = (inputs[0] && inputs[0][0]) ? inputs[0][0] : new Float32Array(128);
        const blockStartFrame = currentFrame; // Absolute context frame timeline
        const blockEndFrame = blockStartFrame + channelData.length;
        // Check if current block intersects with [startFrame, endFrame)
        if (blockEndFrame <= this.startFrame) {
            return true;
        }
        if (blockStartFrame >= this.endFrame) {
            this.active = false;
            this.startFrame = null;
            this.endFrame = null;
            this.port.postMessage({ type: 'COMPLETED' });
            return true;
        }
        console.log('DEBUG [recording-processor]: Intersection!', 'blockStartFrame', blockStartFrame, 'blockEndFrame', blockEndFrame, 'startFrame', this.startFrame, 'endFrame', this.endFrame);
        // Intersection
        const captureStart = Math.max(blockStartFrame, this.startFrame);
        const captureEnd = Math.min(blockEndFrame, this.endFrame);
        const sliceStart = captureStart - blockStartFrame;
        const sliceEnd = captureEnd - blockStartFrame;
        if (sliceEnd > sliceStart) {
            // Extract PCM slice and send via transferable ArrayBuffer
            const slice = channelData.slice(sliceStart, sliceEnd);
            const frameCount = slice.length;
            this.port.postMessage({ type: 'CHUNK', buffer: slice.buffer, frameCount }, [slice.buffer]);
        }
        // Check completion. We must post CHUNK before COMPLETED.
        if (captureEnd === this.endFrame) {
            this.active = false;
            this.startFrame = null;
            this.endFrame = null;
            this.port.postMessage({ type: 'COMPLETED' });
        }
        return true;
    }
}
registerProcessor('recording-processor', RecordingProcessor);
//# sourceMappingURL=recording-processor.js.map