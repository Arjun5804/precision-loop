import { AudioEventSink, AudioScheduler, AudioTimeSource, ScheduledEvent } from '@precision-loop/audio-scheduler';
import { PlaybackPlan } from './playback-plan';
import { BufferCache } from './buffer-cache';
import { TrackMixer } from './track-mixer';
import { HorizonScheduler } from './horizon-scheduler';
import { ISourceNodeWrapper, PlaybackResourceAdapter } from './resource-adapter';
import { InvalidPlaybackPlanError } from './errors';
import { LOOP_ITERATION_EVENT_TYPE, LoopIterationEventPayload } from './types';

export class PlaybackEngine implements AudioEventSink {
  private activePlan: PlaybackPlan | null = null;
  private readonly bufferCache: BufferCache;
  private readonly trackMixer: TrackMixer;
  private readonly horizonScheduler: HorizonScheduler;
  private activeSources = new Set<ISourceNodeWrapper>();

  constructor(
    private readonly adapter: PlaybackResourceAdapter,
    private readonly audioScheduler: AudioScheduler,
    private readonly timeSource: AudioTimeSource,
    schedulingHorizonSeconds: number = 2.0
  ) {
    this.bufferCache = new BufferCache(this.adapter);
    this.trackMixer = new TrackMixer(this.adapter);
    this.horizonScheduler = new HorizonScheduler(this.audioScheduler, schedulingHorizonSeconds);
  }

  /**
   * Starts a playback session based on the provided plan.
   * Valdiates the plan and initializes the graphs and scheduler.
   */
  public start(plan: PlaybackPlan): void {
    this.validatePlan(plan);
    
    // Stop any existing playback before starting a new one
    this.cancel();

    this.activePlan = plan;

    // Prefetch/cache buffers for all takes in the plan
    for (const track of plan.tracks) {
      this.bufferCache.getOrCreate(track.take);
    }

    // Configure track gains and panners
    this.trackMixer.configureTracks(plan.tracks);

    // Run an initial replenish to populate the AudioScheduler queue
    const currentTime = this.timeSource.currentTime();
    this.horizonScheduler.replenish(this.activePlan, currentTime);
  }

  /**
   * Should be called periodically to maintain the scheduling horizon.
   * Can be driven by the same loop that ticks the AudioScheduler.
   */
  public replenish(): void {
    if (!this.activePlan) return;
    const currentTime = this.timeSource.currentTime();
    this.horizonScheduler.replenish(this.activePlan, currentTime);
  }

  /**
   * AudioEventSink implementation. The AudioScheduler dispatches popped events here.
   */
  public schedule(event: ScheduledEvent): void {
    if (event.type !== LOOP_ITERATION_EVENT_TYPE) return;
    
    const payload = event.payload as LoopIterationEventPayload;
    
    // Discard stale events if the session was cancelled or changed
    if (!this.activePlan || payload.playbackSessionId !== this.activePlan.playbackSessionId) {
      return;
    }

    this.executeLoopIteration(event.time, payload);
  }

  private executeLoopIteration(startTime: number, payload: LoopIterationEventPayload): void {
    // We assume the active plan matches the payload due to validation above
    const trackDest = this.trackMixer.getTrackDestination(payload.trackId);
    
    // Retrieve buffer (already cached during start)
    const activeTrack = this.activePlan!.tracks.find(t => t.trackId === payload.trackId)!;
    const buffer = this.bufferCache.getOrCreate(activeTrack.take);

    // Create and schedule the source node
    const source = this.adapter.createSourceNode(buffer);
    source.connect(trackDest);
    
    source.start(startTime);
    source.stop(startTime + payload.duration);

    this.activeSources.add(source);
    
    // TODO: In a real implementation, we would listen for node end to remove it from `activeSources`
    // However, Web Audio handles garbage collection of stopped nodes automatically once they finish playing.
  }

  /**
   * Cancels the current playback session and stops all active sounds immediately.
   */
  public cancel(): void {
    if (!this.activePlan) return;

    // Stop active sources
    this.activeSources.forEach(source => {
      source.stop(); // Stops immediately
      source.disconnect();
    });
    this.activeSources.clear();

    // Reset components
    this.trackMixer.cleanup();
    this.horizonScheduler.reset();
    
    // In a full implementation, we'd also clear pending events from the AudioScheduler
    // using a `audioScheduler.cancel(id -> matches playbackSessionId)` if the API supports it.
    
    this.activePlan = null;
  }

  public stop(): void {
    this.cancel();
  }

  public evictCache(sessionId: string, takeId: string): void {
    this.bufferCache.evict(sessionId, takeId);
  }

  private validatePlan(plan: PlaybackPlan): void {
    if (plan.originTime < 0 || !Number.isFinite(plan.originTime)) {
      throw new InvalidPlaybackPlanError('Invalid originTime');
    }
    for (const track of plan.tracks) {
      if (track.iterationDuration <= 0 || !Number.isFinite(track.iterationDuration)) {
        throw new InvalidPlaybackPlanError(`Invalid iterationDuration for track ${track.trackId}`);
      }
      if (track.volume < 0.0 || track.volume > 1.0) {
        throw new InvalidPlaybackPlanError(`Invalid volume for track ${track.trackId}`);
      }
      if (track.pan < -1.0 || track.pan > 1.0) {
        throw new InvalidPlaybackPlanError(`Invalid pan for track ${track.trackId}`);
      }
    }
  }
}
