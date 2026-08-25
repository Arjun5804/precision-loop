import { RecordingConfig, RecordingState, RecordingWindow, RecordedTake } from './types';
import { 
  InvalidStateError, 
  RecordingPermissionError, 
  DeviceUnavailableError, 
  InvalidWindowError,
  BufferLimitExceededError,
  FinalizationFailureError
} from './errors';
import { timeToFrame } from './utils/frame-math';
import { RecordingWorkletNode } from './RecordingWorkletNode';
import type { MainMessage } from './worklet/messages';

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
      await this.context.audioWorklet.addModule(workletUrl);

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
    const minLookaheadFrames = timeToFrame(0.05, this.context.sampleRate); // 50ms lookahead
    if (startFrame < currentAbsoluteFrame + minLookaheadFrames) {
      throw new InvalidWindowError('startFrame must be in the future with sufficient lookahead (>=50ms)');
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
      const rejectFn = this.rejectTake;
      this.cleanup();
      if (rejectFn) {
        rejectFn(new Error('Recording cancelled'));
      }
      this.setState('IDLE');
    }
  }

  private handleWorkletMessage(msg: MainMessage): void {
    if (msg.type === 'CHUNK') {
      if (this._state === 'ARMED') {
        this.setState('RECORDING');
      }
      
      const f32 = new Float32Array(msg.buffer);
      this.chunks.push(f32);
      this.currentFrameCount += msg.frameCount;
      
      const maxFrames = timeToFrame(this.config.maxDurationSeconds!, this.context.sampleRate);
      if (this.currentFrameCount > maxFrames) {
        this.workletNode?.cancel();
        this.setState('ERROR');
        const rejectFn = this.rejectTake;
        this.cleanup();
        if (rejectFn) rejectFn(new BufferLimitExceededError());
      }
      
    } else if (msg.type === 'COMPLETED') {
      this.setState('FINALIZING');
      try {
        const take = this.finalizeTake();
        const resolveFn = this.resolveTake;
        this.cleanup();
        this.setState('COMPLETED');
        if (resolveFn) resolveFn(take);
      } catch (err: any) {
        this.setState('ERROR');
        const rejectFn = this.rejectTake;
        this.cleanup();
        if (rejectFn) rejectFn(err);
      }
    } else if (msg.type === 'ERROR') {
      this.setState('ERROR');
      const rejectFn = this.rejectTake;
      this.cleanup();
      if (rejectFn) {
        const error = new Error(msg.message);
        (error as any).code = msg.code;
        rejectFn(error);
      }
    }
  }

  private finalizeTake(): RecordedTake {
    const startFrame = timeToFrame(this.activeWindow!.startTime, this.context.sampleRate);
    const endFrame = timeToFrame(this.activeWindow!.endTime, this.context.sampleRate);
    const expectedFrameCount = endFrame - startFrame;

    if (this.currentFrameCount !== expectedFrameCount) {
      throw new FinalizationFailureError(`Expected ${expectedFrameCount} frames, but got ${this.currentFrameCount}`);
    }

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
