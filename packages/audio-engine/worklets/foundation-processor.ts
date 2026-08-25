// Provide missing AudioWorklet typings for the TypeScript compiler
declare class AudioWorkletProcessor {
  constructor();
  readonly port: MessagePort;
}

declare function registerProcessor(
  name: string,
  processorCtor: (new (options?: any) => AudioWorkletProcessor)
): void;

/**
 * Foundation AudioWorkletProcessor.
 * 
 * This processor does not perform any DSP or recording.
 * Its purpose is solely to verify that the AudioWorklet infrastructure
 * can load modules, register processors, create nodes, and pass buffers
 * safely within the environment.
 * 
 * It inspecting actual buffer lengths dynamically rather than
 * assuming a 128-frame render quantum.
 */
class FoundationProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    // Dynamically inspect buffer lengths to avoid assuming 128 frames.
    // We just pass through zeros or do nothing, keeping it trivial.
    for (let outputIdx = 0; outputIdx < outputs.length; ++outputIdx) {
      const output = outputs[outputIdx];
      for (let channel = 0; channel < output.length; ++channel) {
        const outputChannel = output[channel];
        // Ensure we handle whatever buffer length the engine provides
        const length = outputChannel.length;
        for (let i = 0; i < length; ++i) {
          outputChannel[i] = 0; // Trivial output
        }
      }
    }
    
    // Return true to keep the processor alive.
    return true;
  }
}

registerProcessor('foundation-processor', FoundationProcessor);
