export type AudioEngineState =
  | 'uninitialized'
  | 'initializing'
  | 'suspended'
  | 'running'
  | 'closed'
  | 'error';

export interface AudioEngineOptions {
  /**
   * The latency hint to provide to the AudioContext.
   * @default "interactive"
   */
  latencyHint?: AudioContextLatencyCategory | number;
}

export type DeviceType = 'audioinput' | 'audiooutput';

export interface AudioDevice {
  deviceId: string;
  groupId: string;
  kind: DeviceType;
  label: string;
}

export interface AudioEngineCapabilities {
  /**
   * Whether the environment supports changing the output destination (`setSinkId`).
   */
  supportsOutputSelection: boolean;
}

export interface AudioRuntimeInfo {
  sampleRate: number;
  baseLatency: number;
  /**
   * The output latency, if supported by the environment.
   */
  outputLatency: number | null;
}

export type DeviceChangeCallback = (devices: AudioDevice[]) => void;
export type StateChangeCallback = (state: AudioEngineState) => void;
