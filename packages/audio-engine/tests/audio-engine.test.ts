import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from '../src/audio-engine';
import { MockAudioContext, MockMediaDevices, setupGlobals } from './mocks';
import { AudioEngineError, AudioWorkletInitializationError, UnsupportedAudioFeatureError } from '../src/errors';

describe('AudioEngine', () => {
  let mediaDevices: MockMediaDevices;

  beforeEach(() => {
    setupGlobals();
    mediaDevices = new MockMediaDevices();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes context and transitions state', async () => {
    const engine = new AudioEngine(MockAudioContext as any, mediaDevices as any);
    expect(engine.state).toBe('uninitialized');
    
    await engine.initialize();
    
    expect(engine.state).toBe('suspended');
    expect(engine.runtimeInfo.sampleRate).toBe(48000);
    expect(engine.runtimeInfo.baseLatency).toBe(0.01);
  });

  it('can resume and suspend', async () => {
    const engine = new AudioEngine(MockAudioContext as any, mediaDevices as any);
    await engine.initialize();
    
    await engine.resume();
    expect(engine.state).toBe('running');
    
    await engine.suspend();
    expect(engine.state).toBe('suspended');
  });

  it('closes properly', async () => {
    const engine = new AudioEngine(MockAudioContext as any, mediaDevices as any);
    await engine.initialize();
    
    await engine.close();
    expect(engine.state).toBe('closed');
  });

  it('notifies state changes', async () => {
    const engine = new AudioEngine(MockAudioContext as any, mediaDevices as any);
    const cb = vi.fn();
    engine.onStateChange(cb);
    
    await engine.initialize();
    expect(cb).toHaveBeenCalledWith('suspended');
    
    await engine.resume();
    expect(cb).toHaveBeenCalledWith('running');
  });

  it('loads worklets separately', async () => {
    const engine = new AudioEngine(MockAudioContext as any, mediaDevices as any);
    await engine.initialize();
    
    await expect(engine.initializeWorklets('good.js')).resolves.not.toThrow();
    await expect(engine.initializeWorklets('error.js')).rejects.toThrow(AudioWorkletInitializationError);
  });

  it('creates audio time source', async () => {
    const engine = new AudioEngine(MockAudioContext as any, mediaDevices as any);
    await engine.initialize();
    
    const ts = engine.createAudioTimeSource();
    expect(ts.currentTime()).toBe(0);
  });
  
  it('handles output selection capability', async () => {
    const engine = new AudioEngine(MockAudioContext as any, mediaDevices as any);
    // Since MockAudioContext has setSinkId, it's supported
    expect(engine.capabilities.supportsOutputSelection).toBe(true);
    
    await engine.initialize();
    await expect(engine.setOutputDevice('some-device')).resolves.not.toThrow();
    await expect(engine.setOutputDevice('error-device')).rejects.toThrow(AudioEngineError);
  });

  it('rejects output selection if unsupported', async () => {
    class NoSinkContext {
      // Mock enough methods to let initialize() pass
      state = 'suspended';
      sampleRate = 48000;
      baseLatency = 0.01;
      outputLatency = null;
      destination = {};
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      createGain = () => ({ connect: vi.fn(), disconnect: vi.fn() });
    }

    const engine = new AudioEngine(NoSinkContext as any, mediaDevices as any);
    expect(engine.capabilities.supportsOutputSelection).toBe(false);
    
    await engine.initialize();
    await expect(engine.setOutputDevice('some-device')).rejects.toThrow(UnsupportedAudioFeatureError);
  });
});
