import { AudioScheduler, AudioTime, ScheduledEvent } from '@precision-loop/audio-scheduler';
import { PlaybackPlan, TrackPlaybackConfig } from './playback-plan';
import { LOOP_ITERATION_EVENT_TYPE, LoopIterationEventPayload } from './types';

export class HorizonScheduler {
  private lastScheduledIterationByTrack = new Map<string, number>();

  constructor(
    private readonly audioScheduler: AudioScheduler,
    private readonly schedulingHorizonSeconds: number = 2.0
  ) {}

  public replenish(plan: PlaybackPlan, currentTime: AudioTime, activeTrackIds?: ReadonlySet<string>): void {
    const windowEnd = currentTime + this.schedulingHorizonSeconds;

    for (const track of plan.tracks) {
      if (activeTrackIds && !activeTrackIds.has(track.trackId)) continue;
      if (track.iterationDuration <= 0) continue;

      let iteration = this.lastScheduledIterationByTrack.get(track.trackId) ?? 0;

      while (true) {
        const iterationStartTime = plan.originTime + (iteration * track.iterationDuration);
        if (iterationStartTime > windowEnd) break;

        if (iterationStartTime >= currentTime) {
          this.scheduleIteration(plan, track, iteration, iterationStartTime);
        }

        iteration++;
        this.lastScheduledIterationByTrack.set(track.trackId, iteration);
      }
    }
  }

  /** Align a newly activated track to the existing session origin. */
  public activateTrack(plan: PlaybackPlan, trackId: string, currentTime: AudioTime): void {
    const track = plan.tracks.find(t => t.trackId === trackId);
    if (!track || track.iterationDuration <= 0) return;

    const elapsed = Math.max(0, currentTime - plan.originTime);
    const nextIteration = Math.max(0, Math.floor(elapsed / track.iterationDuration));
    this.lastScheduledIterationByTrack.set(trackId, nextIteration);
  }

  public deactivateTrack(trackId: string): void {
    this.lastScheduledIterationByTrack.delete(trackId);
  }

  public reset(): void {
    this.lastScheduledIterationByTrack.clear();
  }

  private scheduleIteration(
    plan: PlaybackPlan,
    track: TrackPlaybackConfig,
    iteration: number,
    startTime: AudioTime
  ): void {
    const eventId = `playback-iter-${plan.playbackSessionId}-${track.trackId}-${iteration}`;
    const payload: LoopIterationEventPayload = {
      playbackSessionId: plan.playbackSessionId,
      trackId: track.trackId,
      takeId: track.take.id,
      iterationIndex: iteration,
      duration: track.iterationDuration,
    };

    const event: ScheduledEvent<LoopIterationEventPayload> = {
      id: eventId,
      time: startTime,
      type: LOOP_ITERATION_EVENT_TYPE,
      payload
    };

    this.audioScheduler.schedule(event);
  }
}
