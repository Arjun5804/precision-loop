/**
 * AudioTime represents absolute seconds on the AudioContext timeline.
 * It is aliased to distinguish from wall-clock time and relative offsets.
 */
export type AudioTime = number;

export interface RecordingWindow {
    startTime: AudioTime;
    endTime: AudioTime;
}

export interface RecordedTake {
    id: string;
    sampleRate: number;
    channelCount: number;
    frameCount: number;
    channels: Float32Array[];
    startTime: AudioTime;
    endTime: AudioTime;
}

export type RecordingState = 
    | 'IDLE' 
    | 'PREPARING' 
    | 'READY' 
    | 'ARMED' 
    | 'RECORDING' 
    | 'FINALIZING' 
    | 'COMPLETED' 
    | 'ERROR';

export interface RecordingConfig {
    deviceId?: string;
    maxDurationSeconds?: number;
}
