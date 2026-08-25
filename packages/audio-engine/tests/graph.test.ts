import { describe, it, expect, vi } from 'vitest';
import { AudioGraph } from '../src/audio-graph';
import { MockAudioContext } from './mocks';

describe('AudioGraph', () => {
  it('creates master gain and connects to destination', () => {
    const ctx = new MockAudioContext() as any;
    const connectSpy = vi.spyOn(ctx.createGain().constructor.prototype, 'connect');
    
    const graph = new AudioGraph(ctx);
    
    expect(graph.masterGain).toBeDefined();
    expect(connectSpy).toHaveBeenCalledWith(ctx.destination);
  });

  it('disconnects on close', () => {
    const ctx = new MockAudioContext() as any;
    const graph = new AudioGraph(ctx);
    
    const disconnectSpy = vi.spyOn(graph.masterGain, 'disconnect');
    
    graph.close();
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
