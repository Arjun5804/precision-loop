import { RecordingConfig, RecordingState, RecordingWindow, RecordedTake } from './types';
import { 
  InvalidStateError, 
  RecordingPermissionError, 
  DeviceUnavailableError, 
  InvalidWindowError,
  BufferLimitExceededError
} from './errors';
import { timeToFrame } from './utils/frame-math';
import { RecordingWorkletNode } from './RecordingWorkletNode';

export class RecordingEngine {
  private _state: RecordingState = 'IDLE';
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: RecordingWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  
  private chunks: Float32Array[] = [];
  private currentFrameCount = 0;
  private activeWindow: RecordingWindow | null = null;
  
  private config: RecordingConfig;
  
  private onStateChangeCb: ((state: RecordingState) => void) | null = null;
  private resolveTake: ((take: RecordedTake) => void) | null = null;
  private rejectTake: ((err: Error) => void) | null = null;

  constructor(
    private readonly context: AudioContext,
    config: RecordingConfig = {}
  ) {
    this.config = {
      maxDurationSeconds: config.maxDurationSeconds ?? 600,
      deviceId: config.deviceId
    };
  }

  get state(): RecordingState {
    return this._state;
  }

  onStateChange(cb: (state: RecordingState) => void): void {
    this.onStateChangeCb = cb;
  }

  private setState(state: RecordingState): void {
    this._state = state;
    if (this.onStateChangeCb) {
      this.onStateChangeCb(state);
    }
  }

  async prepare(workletUrl: string): Promise<void> {
    if (this._state !== 'IDLE') {
      throw new InvalidStateError('Can only prepare from IDLE state', 'NOT_IDLE');
    }
    
    this.setState('PREPARING');

    try {
      try {
        await this.context.audioWorklet.addModule(workletUrl);
      } catch (err) {
        // Module might already be added, ignore
      }

      const constraints: MediaStreamConstraints = {
        audio: this.config.deviceId ? { deviceId: { exact: this.config.deviceId } } : true
      };

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new RecordingPermissionError();
        } else if (err.name === 'NotFoundError') {
          throw new DeviceUnavailableError();
        }
        throw err;
      }

      this.sourceNode = this.context.createMediaStreamSource(this.mediaStream);
      this.workletNode = new RecordingWorkletNode(this.context);
      this.sourceNode.connect(this.workletNode.node);
      
      this.silentGain = this.context.createGain();
      this.silentGain.gain.value = 0;
      
      this.workletNode.connect(this.silentGain);
      this.silentGain.connect(this.context.destination);

      this.workletNode.onMessage((msg) => this.handleWorkletMessage(msg));

      this.setState('READY');
    } catch (err) {
      this.cleanup();
      this.setState('ERROR');
      throw err;
    }
  }

  async arm(window: RecordingWindow): Promise<RecordedTake> {
    if (this._state !== 'READY') {
      throw new InvalidStateError('Must be in READY state to arm', 'NOT_READY');
    }

    if (window.startTime >= window.endTime) {
      throw new InvalidWindowError();
    }

    const startFrame = timeToFrame(window.startTime, this.context.sampleRate);
    const endFrame = timeToFrame(window.endTime, this.context.sampleRate);

    const currentAbsoluteFrame = timeToFrame(this.context.currentTime, this.context.sampleRate);
    if (startFrame < currentAbsoluteFrame) {
      throw new InvalidWindowError('startFrame is already in the past');
    }

    const maxFrames = timeToFrame(this.config.maxDurationSeconds!, this.context.sampleRate);
    if ((endFrame - startFrame) > maxFrames) {
      throw new BufferLimitExceededError();
    }

    this.activeWindow = window;
    this.chunks = [];
    this.currentFrameCount = 0;
    
    this.setState('ARMED');
    
    this.workletNode!.arm(startFrame, endFrame);

    return new Promise((resolve, reject) => {
      this.resolveTake = resolve;
      this.rejectTake = reject;
    });
  }

  cancel(): void {
    if (this._state === 'ARMED' || this._state === 'RECORDING') {
      this.workletNode?.cancel();
      this.cleanup();
      if (this.rejectTake) {
        this.rejectTake(new Error('Recording cancelled'));
      }
      this.setState('IDLE');
    }
  }

  private handleWorkletMessage(msg: any): void {
    if (msg.type === 'CHUNK') {
      if (this._state === 'ARMED') {
        this.setState('RECORDING');
      }
      
      const f32 = new Float32Array(msg.buffer);
      this.chunks.push(f32);
      this.currentFrameCount += f32.length;
      
      const maxFrames = timeToFrame(this.config.maxDurationSeconds!, this.context.sampleRate);
      if (this.currentFrameCount > maxFrames) {
        this.workletNode?.cancel();
        this.setState('ERROR');
        this.cleanup();
        if (this.rejectTake) this.rejectTake(new BufferLimitExceededError());
      }
      
    } else if (msg.type === 'COMPLETED') {
      this.setState('FINALIZING');
      const take = this.finalizeTake();
      this.cleanup();
      this.setState('COMPLETED');
      if (this.resolveTake) this.resolveTake(take);
      
    } else if (msg.type === 'ERROR') {
      this.setState('ERROR');
      this.cleanup();
      if (this.rejectTake) this.rejectTake(new Error(msg.message));
    }
  }

  private finalizeTake(): RecordedTake {
    const totalFrames = this.currentFrameCount;
    const channelData = new Float32Array(totalFrames);
    let offset = 0;
    for (const chunk of this.chunks) {
      channelData.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      id: crypto.randomUUID(),
      sampleRate: this.context.sampleRate,
      channelCount: 1,
      frameCount: totalFrames,
      channels: [channelData],
      startTime: this.activeWindow!.startTime,
      endTime: this.activeWindow!.endTime,
    };
  }

  private cleanup(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.silentGain) {
      this.silentGain.disconnect();
      this.silentGain = null;
    }
    this.chunks = [];
    this.currentFrameCount = 0;
    this.activeWindow = null;
    this.resolveTake = null;
    this.rejectTake = null;
  }
}
