import { Session } from '@precision-loop/loop-model';
import { MusicalClock } from '@precision-loop/musical-clock';
import { PlaybackPlan, TrackPlaybackConfig } from '@precision-loop/playback-engine';
import { AudioTime } from '@precision-loop/audio-scheduler';

/**
 * Pure adapter function to derive an audio-domain PlaybackPlan from the domain Session.
 * Uses the provided MusicalClock to resolve musical lengths to absolute durations.
 */
export function buildPlaybackPlan(
    session: Session,
    clock: MusicalClock,
    playbackSessionId: string,
    originTime: AudioTime
): PlaybackPlan {
    const tracks: TrackPlaybackConfig[] = [];
    
    for (const track of session.getTracks()) {
        const loop = track.getLoop();
        if (loop) {
            tracks.push({
                trackId: track.id,
                take: loop.take,
                iterationDuration: clock.barsToSeconds(loop.musicalLength.bars),
                volume: track.getVolume(),
                pan: track.getPan(),
                muted: track.getMuted(),
                soloed: track.getSoloed()
            });
        }
    }
    
    return {
        sessionId: session.id,
        playbackSessionId,
        originTime,
        tracks
    };
}
