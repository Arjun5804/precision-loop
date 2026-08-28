import type { Tempo, TimeSignature } from '@precision-loop/musical-clock';
import type { AudioTime, RecordingWindow, RecordedTake } from '@precision-loop/recording-engine';

export interface TransportConfig {
  tempo: Tempo;
  timeSignature: TimeSignature;
  countInBars: number;
  /** Number of bars to record. If undefined, recording is open-ended. */
  recordingBars?: number;
}

export interface ClickEvent {
  audioTime: AudioTime;
  barIndex: number;
  beatIndex: number;
  accent: boolean;
}

export interface TransportPlan {
  sessionStartTime: AudioTime;
  recordingStartTime: AudioTime;
  recordingEndTime: AudioTime;
  recordingWindow: RecordingWindow;
  countInEvents: ClickEvent[];
}

export type TransportState = 
  | 'IDLE' 
  | 'ARMING' 
  | 'ACTIVE' 
  | 'COMPLETED' 
  | 'ERROR';
