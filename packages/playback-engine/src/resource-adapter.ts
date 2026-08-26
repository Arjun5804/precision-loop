import { Take } from '@precision-loop/loop-model';
import { AudioTime } from '@precision-loop/audio-scheduler';

/**
 * Interface for the internal representation of an AudioBuffer.
 * For the web implementation, this just holds the AudioBuffer.
 */
export interface IAudioBufferWrapper {
  readonly sampleRate: number;
  readonly length: number;
  readonly duration: number;
  readonly numberOfChannels: number;
}

/**
 * Handle to a scheduled source node.
 */
export interface ISourceNodeWrapper {
  start(when: AudioTime): void;
  stop(when?: AudioTime): void;
  disconnect(): void;
  connect(destination: IAudioNodeWrapper): void;
  onEnded(callback: () => void): void;
}

/**
 * Generic node wrapper.
 */
export interface IAudioNodeWrapper {
  connect(destination: IAudioNodeWrapper): void;
  disconnect(): void;
}

export interface IGainNodeWrapper extends IAudioNodeWrapper {
  setGain(value: number): void;
}

export interface IPannerNodeWrapper extends IAudioNodeWrapper {
  setPan(value: number): void;
}

/**
 * Abstract factory to isolate Web Audio DOM objects.
 */
export interface PlaybackResourceAdapter {
  createBufferFromTake(take: Take): IAudioBufferWrapper;
  createSourceNode(buffer: IAudioBufferWrapper): ISourceNodeWrapper;
  createGainNode(): IGainNodeWrapper;
  createStereoPannerNode(): IPannerNodeWrapper;
  
  /**
   * Connects a wrapped node to the AudioEngine's master destination.
   */
  connectToMaster(node: IAudioNodeWrapper): void;
  disconnectFromMaster(node: IAudioNodeWrapper): void;
}
