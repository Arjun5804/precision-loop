export class MockAudioNode {
  connect() {}
  disconnect() {}
}

export class MockGainNode extends MockAudioNode {}
export class MockAudioWorkletNode extends MockAudioNode {
  constructor(context: any, name: string) {
    super();
  }
}

export class MockAudioContext {
  state: string = 'suspended';
  sampleRate: number = 48000;
  baseLatency: number = 0.01;
  outputLatency: number = 0.02;
  currentTime: number = 0;
  
  destination = new MockAudioNode();
  
  listeners: Record<string, Function[]> = {};

  audioWorklet = {
    addModule: async (url: string) => {
      if (url.includes('error')) throw new Error('Network error');
    }
  };

  createGain() {
    return new MockGainNode();
  }

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  async resume() {
    if (this.state === 'closed') throw new Error('Cannot resume closed context');
    this.state = 'running';
    this.fireEvent('statechange');
  }

  async suspend() {
    if (this.state === 'closed') throw new Error('Cannot suspend closed context');
    this.state = 'suspended';
    this.fireEvent('statechange');
  }

  async close() {
    this.state = 'closed';
    this.fireEvent('statechange');
  }

  async setSinkId(id: string) {
    if (id === 'error-device') throw new Error('Invalid device');
  }

  private fireEvent(event: string) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        cb();
      }
    }
  }
}

export class MockMediaDevices {
  listeners: Record<string, Function[]> = {};
  
  devices: any[] = [
    { deviceId: 'default', kind: 'audiooutput', label: 'Default Output', groupId: 'g1' },
    { deviceId: 'mic1', kind: 'audioinput', label: 'Built-in Mic', groupId: 'g2' },
  ];

  async enumerateDevices() {
    return this.devices;
  }

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }
  
  fireDeviceChange() {
    if (this.listeners['devicechange']) {
      for (const cb of this.listeners['devicechange']) {
        cb();
      }
    }
  }
}

export function setupGlobals() {
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).AudioWorkletNode = MockAudioWorkletNode;
}
