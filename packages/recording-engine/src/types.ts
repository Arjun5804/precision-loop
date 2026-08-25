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
