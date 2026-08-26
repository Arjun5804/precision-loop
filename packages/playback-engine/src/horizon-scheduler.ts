import { AudioScheduler, AudioTime, ScheduledEvent } from '@precision-loop/audio-scheduler';
import { PlaybackPlan, TrackPlaybackConfig } from './playback-plan';
import { LOOP_ITERATION_EVENT_TYPE, LoopIterationEventPayload } from './types';

export class HorizonScheduler {
  private lastScheduledIterationByTrack = new Map<string, number>();

  constructor(
    private readonly audioScheduler: AudioScheduler,
    private readonly schedulingHorizonSeconds: number = 2.0
  ) {}

  /**
   * Should be called periodically (e.g. at the same time AudioScheduler.tick() is called).
   * Calculates the scheduling window [currentTime, currentTime + horizon] and queues
   * any iterations that fall into this window.
   */
  public replenish(plan: PlaybackPlan, currentTime: AudioTime): void {
    const windowEnd = currentTime + this.schedulingHorizonSeconds;

    for (const track of plan.tracks) {
      if (track.iterationDuration <= 0) continue; // Safety check

      let iteration = this.lastScheduledIterationByTrack.get(track.trackId) ?? 0;
      
      while (true) {
        const iterationStartTime = plan.originTime + (iteration * track.iterationDuration);
        
        // Stop queuing if this iteration is beyond our horizon
        if (iterationStartTime > windowEnd) {
          break;
        }

        if (iterationStartTime >= currentTime) {
          this.scheduleIteration(plan, track, iteration, iterationStartTime);
        }
        
        iteration++;
        this.lastScheduledIterationByTrack.set(track.trackId, iteration);
      }
    }
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

    // The AudioScheduler natively prevents duplicate submissions via the unique event ID
    this.audioScheduler.schedule(event);
  }
}
