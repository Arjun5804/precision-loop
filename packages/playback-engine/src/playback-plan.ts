import { Take } from '@precision-loop/loop-model';
import { AudioTime } from '@precision-loop/audio-scheduler';

/**
 * A resolved AudioTime duration for a single loop iteration.
 * The Playback Engine MUST NOT derive this from BPM, time signature, or musical bars.
 * The Application Controller resolves this from musical intent.
 * 
 * Invariants:
 * - Must be strictly greater than 0.
 * - Take.frameCount / Take.sampleRate should ideally equal iterationDuration, but 
 *   the playback engine respects iterationDuration as the authoritative scheduling boundary.
 */
export interface TrackPlaybackConfig {
  trackId: string;
  take: Take; 
  iterationDuration: number; 
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
}

/**
 * An audio-domain configuration provided to the Playback Engine to begin playback.
 */
export interface PlaybackPlan {
  sessionId: string;
  playbackSessionId: string;
  
  /**
   * Absolute AudioTime to anchor N=0.
   */
  originTime: AudioTime; 
  
  tracks: TrackPlaybackConfig[];
}
