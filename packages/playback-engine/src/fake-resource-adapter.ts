import { Take } from '@precision-loop/loop-model';
import { AudioTime } from '@precision-loop/audio-scheduler';
import { 
  PlaybackResourceAdapter, 
  IAudioBufferWrapper, 
  ISourceNodeWrapper, 
  IGainNodeWrapper, 
  IPannerNodeWrapper, 
  IAudioNodeWrapper 
} from './resource-adapter';

export class FakeAudioBufferWrapper implements IAudioBufferWrapper {
  constructor(
    public readonly sampleRate: number,
    public readonly length: number,
    public readonly duration: number,
    public readonly numberOfChannels: number
  ) {}
}

export class FakeNodeWrapper implements IAudioNodeWrapper {
  public connectedTo: IAudioNodeWrapper | 'master' | null = null;
  public isDisconnected = false;
  
  connect(destination: IAudioNodeWrapper): void {
    this.connectedTo = destination;
    this.isDisconnected = false;
  }
  
  disconnect(): void {
    this.connectedTo = null;
    this.isDisconnected = true;
  }
}

export class FakeGainNodeWrapper extends FakeNodeWrapper implements IGainNodeWrapper {
  public gainValue: number = 1.0;
  
  setGain(value: number): void {
    this.gainValue = value;
  }
}

export class FakePannerNodeWrapper extends FakeNodeWrapper implements IPannerNodeWrapper {
  public panValue: number = 0.0;
  
  setPan(value: number): void {
    this.panValue = value;
  }
}

export class FakeSourceNodeWrapper extends FakeNodeWrapper implements ISourceNodeWrapper {
  public startedAt: AudioTime | null = null;
  public stoppedAt: AudioTime | null = null;
  public buffer: FakeAudioBufferWrapper;
  
  constructor(buffer: FakeAudioBufferWrapper) {
    super();
    this.buffer = buffer;
  }
  
  start(when: AudioTime): void {
    this.startedAt = when;
  }
  
  stop(when?: AudioTime): void {
    this.stoppedAt = when ?? -1;
  }
}

export class FakeResourceAdapter implements PlaybackResourceAdapter {
  public createdBuffers: FakeAudioBufferWrapper[] = [];
  public createdSources: FakeSourceNodeWrapper[] = [];
  
  createBufferFromTake(take: Take): IAudioBufferWrapper {
    const wrapper = new FakeAudioBufferWrapper(
      take.sampleRate,
      take.frameCount,
      take.frameCount / take.sampleRate,
      take.channelCount
    );
    this.createdBuffers.push(wrapper);
    return wrapper;
  }

  createSourceNode(buffer: IAudioBufferWrapper): ISourceNodeWrapper {
    const source = new FakeSourceNodeWrapper(buffer as FakeAudioBufferWrapper);
    this.createdSources.push(source);
    return source;
  }

  createGainNode(): IGainNodeWrapper {
    return new FakeGainNodeWrapper();
  }

  createStereoPannerNode(): IPannerNodeWrapper {
    return new FakePannerNodeWrapper();
  }

  connectToMaster(node: IAudioNodeWrapper): void {
    if (node instanceof FakeNodeWrapper) {
      node.connectedTo = 'master';
    }
  }

  disconnectFromMaster(node: IAudioNodeWrapper): void {
    node.disconnect();
  }
}
