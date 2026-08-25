import { AudioDevice, DeviceChangeCallback } from './types';
import { AudioDeviceError } from './errors';

export class AudioDeviceManager {
  private devices: AudioDevice[] = [];
  private callbacks: Set<DeviceChangeCallback> = new Set();
  private boundHandleDeviceChange: () => Promise<void>;

  constructor(
    private mediaDevices: MediaDevices | undefined = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  ) {
    this.boundHandleDeviceChange = this.handleDeviceChange.bind(this);
  }

  public async initialize(): Promise<void> {
    if (!this.mediaDevices) {
      // Gracefully handle environments without mediaDevices (e.g. non-secure contexts)
      return;
    }

    try {
      await this.refreshDevices();
      // Listen for device changes
      this.mediaDevices.addEventListener('devicechange', this.boundHandleDeviceChange);
    } catch (err) {
      throw new AudioDeviceError('Failed to initialize AudioDeviceManager', err);
    }
  }

  public getDevices(): AudioDevice[] {
    return this.devices;
  }

  public onDeviceChange(callback: DeviceChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public close(): void {
    if (this.mediaDevices) {
      this.mediaDevices.removeEventListener('devicechange', this.boundHandleDeviceChange);
    }
    this.callbacks.clear();
  }

  private async refreshDevices(): Promise<void> {
    if (!this.mediaDevices) return;

    try {
      const rawDevices = await this.mediaDevices.enumerateDevices();
      
      this.devices = rawDevices
        .filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput')
        .map(d => ({
          deviceId: d.deviceId,
          groupId: d.groupId,
          kind: d.kind as 'audioinput' | 'audiooutput',
          label: d.label // May be empty before permission is granted
        }));
    } catch (err) {
      throw new AudioDeviceError('Failed to enumerate devices', err);
    }
  }

  private async handleDeviceChange(): Promise<void> {
    await this.refreshDevices();
    this.notifyCallbacks();
  }

  private notifyCallbacks(): void {
    for (const callback of this.callbacks) {
      try {
        callback(this.devices);
      } catch (e) {
        console.error('Error in device change callback:', e);
      }
    }
  }
}
