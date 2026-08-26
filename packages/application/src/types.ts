export type AppState = 'IDLE' | 'PREPARING' | 'RECORDING' | 'PLAYING' | 'ERROR';

export interface ApplicationConfig {
    recordingWorkletUrl: string;
    foundationWorkletUrl: string;
    sessionLeadTimeSeconds: number; // Configurable explicit lead time
}
