import { ManagedAudioContext } from './audio-context';
import { AudioDeviceManager } from './audio-devices';
import { AudioGraph } from './audio-graph';
import { detectCapabilities } from './capabilities';
import { AudioTimeSource, createAudioTimeSource } from './scheduler-adapter';
import {
  AudioEngineOptions,
  AudioEngineState,
  AudioEngineCapabilities,
  AudioDevice,
  DeviceChangeCallback,
  StateChangeCallback,
  AudioRuntimeInfo
} from './types';
import { AudioEngineError, AudioWorkletInitializationError, UnsupportedAudioFeatureError } from './errors';

export class AudioEngine {
  private managedContext: ManagedAudioContext;
  private deviceManager: AudioDeviceManager;
  private graph: AudioGraph | null = null;
  private _capabilities: AudioEngineCapabilities;
  
  constructor(
    private ContextClass: typeof AudioContext = globalThis.AudioContext,
    private mediaDevices: MediaDevices | undefined = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  ) {
    this.managedContext = new ManagedAudioContext(this.ContextClass);
    this.deviceManager = new AudioDeviceManager(this.mediaDevices);
    this._capabilities = detectCapabilities(this.ContextClass);
  }

  public async initialize(options: AudioEngineOptions = {}): Promise<void> {
    const latencyHint = options.latencyHint ?? 'interactive';
    
    // 1. Initialize Context
    this.managedContext.initialize(latencyHint);
    
    // 2. Create Root Graph
    this.graph = new AudioGraph(this.managedContext.context);
    
    // 3. Initialize Device Manager
    await this.deviceManager.initialize();
  }

  /**
   * Separated Worklet initialization.
   * Loads the foundation worklet from the provided URL to verify infrastructure.
   */
  public async initializeWorklets(foundationWorkletUrl: string): Promise<void> {
    if (this.state === 'uninitialized') {
      throw new AudioEngineError('AudioEngine must be initialized before loading worklets');
    }

    try {
      await this.managedContext.context.audioWorklet.addModule(foundationWorkletUrl);
      
      // Verify node creation
      const node = new AudioWorkletNode(this.managedContext.context, 'foundation-processor');
      
      // Optionally connect and disconnect to verify graph topology
      node.connect(this.graph!.masterGain);
      node.disconnect();
    } catch (err) {
      throw new AudioWorkletInitializationError('Failed to initialize AudioWorklet infrastructure', err);
    }
  }

  // Facade Methods for Context State
  public get state(): AudioEngineState {
    return this.managedContext.state;
  }

  public onStateChange(callback: StateChangeCallback): () => void {
    return this.managedContext.onStateChange(callback);
  }

  public async resume(): Promise<void> {
    await this.managedContext.resume();
  }

  public async suspend(): Promise<void> {
    await this.managedContext.suspend();
  }

  public async close(): Promise<void> {
    this.deviceManager.close();
    
    if (this.graph) {
      this.graph.close();
      this.graph = null;
    }
    
    await this.managedContext.close();
  }

  // Runtime properties
  public get runtimeInfo(): AudioRuntimeInfo {
    return {
      sampleRate: this.managedContext.sampleRate,
      baseLatency: this.managedContext.baseLatency,
      outputLatency: this.managedContext.outputLatency
    };
  }

  public get capabilities(): AudioEngineCapabilities {
    return this._capabilities;
  }

  // Devices
  public get devices(): AudioDevice[] {
    return this.deviceManager.getDevices();
  }

  public onDeviceChange(callback: DeviceChangeCallback): () => void {
    return this.deviceManager.onDeviceChange(callback);
  }

  public async setOutputDevice(deviceId: string): Promise<void> {
    if (!this.capabilities.supportsOutputSelection) {
      throw new UnsupportedAudioFeatureError('Output device selection (setSinkId) is not supported in this environment');
    }

    try {
      // Type casting because setSinkId is not in standard TS DOM lib for AudioContext yet
      await (this.managedContext.context as any).setSinkId(deviceId);
    } catch (err) {
      throw new AudioEngineError('Failed to set output device', err);
    }
  }

  // Master Graph Boundary
  public connectToMaster(node: AudioNode): void {
    if (!this.graph) {
      throw new AudioEngineError('AudioEngine must be initialized before connecting to master graph');
    }
    node.connect(this.graph.masterGain);
  }

  public disconnectFromMaster(node: AudioNode): void {
    // Standard way to disconnect a node from its destination.
    // If it's only connected to masterGain, this cleanly removes it.
    node.disconnect();
  }

  // Scheduler Boundary
  public createAudioTimeSource(): AudioTimeSource {
    return createAudioTimeSource(() => this.managedContext.context);
  }
}
