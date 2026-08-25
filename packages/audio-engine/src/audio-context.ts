import { AudioContextStateError, AudioContextInitializationError } from './errors';
import { AudioEngineState, StateChangeCallback } from './types';

export class ManagedAudioContext {
  private _context: AudioContext | null = null;
  private _state: AudioEngineState = 'uninitialized';
  private callbacks: Set<StateChangeCallback> = new Set();
  private boundHandleStateChange: () => void;

  constructor(private ContextClass: typeof AudioContext = globalThis.AudioContext) {
    this.boundHandleStateChange = this.handleStateChange.bind(this);
  }

  public get context(): AudioContext {
    if (!this._context) {
      throw new AudioContextStateError('AudioContext is not initialized');
    }
    return this._context;
  }

  public get state(): AudioEngineState {
    return this._state;
  }

  public get sampleRate(): number {
    return this.context.sampleRate;
  }

  public get baseLatency(): number {
    return this.context.baseLatency;
  }

  public get outputLatency(): number | null {
    // outputLatency is not available in all browsers (e.g. Safari or older versions)
    if ('outputLatency' in this.context) {
      return (this.context as any).outputLatency;
    }
    return null;
  }

  public initialize(latencyHint: AudioContextLatencyCategory | number = 'interactive'): void {
    if (this._context) {
      throw new AudioContextInitializationError('AudioContext is already initialized');
    }
    
    try {
      this.updateState('initializing');
      
      this._context = new this.ContextClass({ latencyHint });
      this._context.addEventListener('statechange', this.boundHandleStateChange);
      
      // Sync initial state from context
      this.syncState();
    } catch (err) {
      this.updateState('error');
      throw new AudioContextInitializationError('Failed to create AudioContext', err);
    }
  }

  public async resume(): Promise<void> {
    const ctx = this.context;
    if (ctx.state === 'running') return;
    
    try {
      await ctx.resume();
    } catch (err) {
      throw new AudioContextStateError('Failed to resume AudioContext', err);
    }
  }

  public async suspend(): Promise<void> {
    const ctx = this.context;
    if (ctx.state === 'suspended') return;
    
    try {
      await ctx.suspend();
    } catch (err) {
      throw new AudioContextStateError('Failed to suspend AudioContext', err);
    }
  }

  public async close(): Promise<void> {
    if (!this._context) {
      this.updateState('closed');
      return;
    }

    this._context.removeEventListener('statechange', this.boundHandleStateChange);

    try {
      if (this._context.state !== 'closed') {
        await this._context.close();
      }
    } catch (err) {
      // Best effort cleanup
    } finally {
      this._context = null;
      this.updateState('closed');
      this.callbacks.clear();
    }
  }

  public onStateChange(callback: StateChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  private handleStateChange(): void {
    this.syncState();
  }

  private syncState(): void {
    if (!this._context) return;
    
    switch (this._context.state) {
      case 'suspended':
        this.updateState('suspended');
        break;
      case 'running':
        this.updateState('running');
        break;
      case 'closed':
        this.updateState('closed');
        break;
    }
  }

  private updateState(newState: AudioEngineState): void {
    if (this._state === newState) return;
    this._state = newState;
    
    for (const callback of this.callbacks) {
      try {
        callback(this._state);
      } catch (e) {
        console.error('Error in state change callback:', e);
      }
    }
  }
}
