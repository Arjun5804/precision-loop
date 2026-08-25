/**
 * This type mimics the interface expected by `@precision-loop/audio-scheduler`.
 * Using structural typing, we avoid a hard runtime import dependency on the scheduler
 * within this file if we don't strictly need to bundle it, but defining it here
 * provides the boundary adapter.
 */
export interface AudioTimeSource {
  readonly currentTime: number;
}

export function createAudioTimeSource(getContext: () => AudioContext): AudioTimeSource {
  return {
    get currentTime(): number {
      return getContext().currentTime;
    }
  };
}
