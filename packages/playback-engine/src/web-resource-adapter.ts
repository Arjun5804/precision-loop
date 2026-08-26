import { Take } from '@precision-loop/loop-model';
import { AudioTime } from '@precision-loop/audio-scheduler';
import { AudioEngine } from '@precision-loop/audio-engine';
import { 
  PlaybackResourceAdapter, 
  IAudioBufferWrapper, 
  ISourceNodeWrapper, 
  IGainNodeWrapper, 
  IPannerNodeWrapper, 
  IAudioNodeWrapper 
} from './resource-adapter';

export class WebAudioBufferWrapper implements IAudioBufferWrapper {
  constructor(public readonly buffer: AudioBuffer) {}
  
  get sampleRate() { return this.buffer.sampleRate; }
  get length() { return this.buffer.length; }
  get duration() { return this.buffer.duration; }
  get numberOfChannels() { return this.buffer.numberOfChannels; }
}

class WebNodeWrapper<T extends AudioNode> implements IAudioNodeWrapper {
  constructor(public readonly node: T) {}

  connect(destination: IAudioNodeWrapper): void {
    if (destination instanceof WebNodeWrapper) {
      this.node.connect(destination.node);
    }
  }

  disconnect(): void {
    this.node.disconnect();
  }
}

class WebGainNodeWrapper extends WebNodeWrapper<GainNode> implements IGainNodeWrapper {
  setGain(value: number): void {
    this.node.gain.value = value;
  }
}

class WebPannerNodeWrapper extends WebNodeWrapper<StereoPannerNode> implements IPannerNodeWrapper {
  setPan(value: number): void {
    this.node.pan.value = value;
  }
}

class WebSourceNodeWrapper extends WebNodeWrapper<AudioBufferSourceNode> implements ISourceNodeWrapper {
  start(when: AudioTime): void {
    this.node.start(when);
  }
  
  stop(when?: AudioTime): void {
    if (when !== undefined) {
      this.node.stop(when);
    } else {
      this.node.stop();
    }
  }
}

export class WebResourceAdapter implements PlaybackResourceAdapter {
  constructor(
    private readonly context: AudioContext,
    private readonly audioEngine: AudioEngine
  ) {}

  createBufferFromTake(take: Take): IAudioBufferWrapper {
    const buffer = this.context.createBuffer(
      take.channelCount,
      take.frameCount,
      take.sampleRate
    );
    
    for (let i = 0; i < take.channelCount; i++) {
      buffer.copyToChannel(take.channels[i] as any, i);
    }
    
    return new WebAudioBufferWrapper(buffer);
  }

  createSourceNode(bufferWrapper: IAudioBufferWrapper): ISourceNodeWrapper {
    if (!(bufferWrapper instanceof WebAudioBufferWrapper)) {
      throw new Error("Invalid buffer wrapper type");
    }
    const source = this.context.createBufferSource();
    source.buffer = bufferWrapper.buffer;
    return new WebSourceNodeWrapper(source);
  }

  createGainNode(): IGainNodeWrapper {
    return new WebGainNodeWrapper(this.context.createGain());
  }

  createStereoPannerNode(): IPannerNodeWrapper {
    return new WebPannerNodeWrapper(this.context.createStereoPanner());
  }

  connectToMaster(node: IAudioNodeWrapper): void {
    if (node instanceof WebNodeWrapper) {
      this.audioEngine.connectToMaster(node.node);
    }
  }

  disconnectFromMaster(node: IAudioNodeWrapper): void {
    if (node instanceof WebNodeWrapper) {
      this.audioEngine.disconnectFromMaster(node.node);
    }
  }
}
