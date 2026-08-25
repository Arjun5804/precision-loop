import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioDeviceManager } from '../src/audio-devices';
import { MockMediaDevices } from './mocks';

describe('AudioDeviceManager', () => {
  let mediaDevices: MockMediaDevices;

  beforeEach(() => {
    mediaDevices = new MockMediaDevices();
  });

  it('initializes without mediaDevices gracefully', async () => {
    const manager = new AudioDeviceManager(undefined);
    await manager.initialize();
    expect(manager.getDevices()).toEqual([]);
  });

  it('enumerates devices on initialize', async () => {
    const manager = new AudioDeviceManager(mediaDevices as any);
    await manager.initialize();
    
    const devices = manager.getDevices();
    expect(devices.length).toBe(2);
    expect(devices[0].kind).toBe('audiooutput');
    expect(devices[1].kind).toBe('audioinput');
  });

  it('fires callbacks on devicechange', async () => {
    const manager = new AudioDeviceManager(mediaDevices as any);
    await manager.initialize();
    
    const cb = vi.fn();
    manager.onDeviceChange(cb);
    
    mediaDevices.devices.push({ deviceId: 'new', kind: 'audioinput', label: 'New', groupId: 'g3' });
    mediaDevices.fireDeviceChange();
    
    // allow microtasks to flush
    await new Promise(r => setTimeout(r, 0));
    
    expect(cb).toHaveBeenCalled();
    expect(manager.getDevices().length).toBe(3);
  });
});
