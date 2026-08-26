import { AudioTime } from '@precision-loop/audio-scheduler';

export interface LoopIterationEventPayload {
  playbackSessionId: string;
  trackId: string;
  takeId: string; // Used to fetch from cache
  iterationIndex: number;
  duration: number; // Iteration duration in seconds
}

export const LOOP_ITERATION_EVENT_TYPE = 'PLAYBACK_ENGINE_LOOP_ITERATION';
