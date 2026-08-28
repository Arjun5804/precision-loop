import { MainMessage, WorkletMessage } from './worklet/messages';

export class RecordingWorkletNode {
  public readonly node: AudioWorkletNode;

  constructor(context: AudioContext) {
    this.node = new AudioWorkletNode(context, 'recording-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
  }

  arm(startFrame: number, endFrame: number): void {
    this.node.port.postMessage({ type: 'ARM', startFrame, endFrame } as WorkletMessage);
  }

  finalize(endFrame: number): void {
    this.node.port.postMessage({ type: 'FINALIZE', endFrame } as WorkletMessage);
  }

  cancel(): void {
    this.node.port.postMessage({ type: 'CANCEL' } as WorkletMessage);
  }

  onMessage(callback: (msg: MainMessage) => void): void {
    this.node.port.onmessage = (event) => {
      callback(event.data as MainMessage);
    };
  }

  connect(destination: AudioNode): void {
    this.node.connect(destination);
  }

  disconnect(): void {
    this.node.disconnect();
  }
}
