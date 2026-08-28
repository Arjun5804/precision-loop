export type AppState = 'IDLE' | 'PREPARING' | 'RECORDING' | 'PLAYING' | 'ERROR';

export type RecordingMode = 'FREE' | 'BAR';

export interface TrackRecordingSettings {
    /** Number of count-in bars before recording begins. Default: 1. */
    countInBars: number;
    /** Number of bars to record. Only used in BAR mode. Default: 4. */
    recordingBars: number;
    /** FREE = open-ended (user clicks STOP), BAR = auto-stop after recordingBars. */
    mode: RecordingMode;
}

export const DEFAULT_TRACK_SETTINGS: TrackRecordingSettings = {
    countInBars: 1,
    recordingBars: 4,
    mode: 'FREE',
};

export interface ApplicationConfig {
    recordingWorkletUrl: string;
    foundationWorkletUrl: string;
    sessionLeadTimeSeconds: number; // Configurable explicit lead time
}
