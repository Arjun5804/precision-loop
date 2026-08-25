declare class AudioWorkletProcessor {
  constructor();
  readonly port: MessagePort;
}

declare function registerProcessor(
  name: string,
  processorCtor: (new (options?: any) => AudioWorkletProcessor)
): void;

declare const currentFrame: number;

type WorkletMessage =
  | { type: 'ARM'; startFrame: number; endFrame: number }
  | { type: 'CANCEL' };

type MainMessage =
  | { type: 'CHUNK'; buffer: ArrayBuffer }
  | { type: 'COMPLETED' }
  | { type: 'ERROR'; message: string };

class RecordingProcessor extends AudioWorkletProcessor {
  private startFrame: number | null = null;
  private endFrame: number | null = null;
  private active = false;

  constructor() {
    super();
    this.port.onmessage = (event) => {
      const msg = event.data as WorkletMessage;
      if (msg.type === 'ARM') {
        this.startFrame = msg.startFrame;
        this.endFrame = msg.endFrame;
        this.active = true;
      } else if (msg.type === 'CANCEL') {
        this.active = false;
        this.startFrame = null;
        this.endFrame = null;
      }
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    if (!this.active || this.startFrame === null || this.endFrame === null) {
      return true; // Keep processing silently
    }

    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const channelData = input[0];
    const blockStartFrame = currentFrame; // Absolute context frame timeline
    const blockEndFrame = blockStartFrame + channelData.length;

    // Check if current block intersects with [startFrame, endFrame)
    if (blockEndFrame <= this.startFrame || blockStartFrame >= this.endFrame) {
      return true;
    }

    // Intersection
    const captureStart = Math.max(blockStartFrame, this.startFrame);
    const captureEnd = Math.min(blockEndFrame, this.endFrame);

    const sliceStart = captureStart - blockStartFrame;
    const sliceEnd = captureEnd - blockStartFrame;

    if (sliceEnd > sliceStart) {
      // Extract PCM slice and send via transferable ArrayBuffer
      const slice = channelData.slice(sliceStart, sliceEnd);
      this.port.postMessage(
        { type: 'CHUNK', buffer: slice.buffer } as MainMessage,
        [slice.buffer]
      );
    }

    // Check completion. We must post CHUNK before COMPLETED.
    if (captureEnd === this.endFrame) {
      this.active = false;
      this.startFrame = null;
      this.endFrame = null;
      this.port.postMessage({ type: 'COMPLETED' } as MainMessage);
    }

    return true;
  }
}

registerProcessor('recording-processor', RecordingProcessor);
