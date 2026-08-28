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
  private activeSources = new Map<string, Set<ISourceNodeWrapper>>();
  private activeTrackIds = new Set<string>();

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
   * Start a playback session. By default every loop in the plan is active.
   * A subset may be supplied for independent track playback; the complete
   * plan is still retained so additional tracks can be started later without
   * creating a second playback clock/origin.
   */
  public start(plan: PlaybackPlan, initialActiveTrackIds?: ReadonlySet<string>): void {
    this.validatePlan(plan);
    this.cancel();
    this.activePlan = plan;

    const availableTrackIds = new Set(plan.tracks.map(t => t.trackId));
    this.activeTrackIds = initialActiveTrackIds
      ? new Set([...initialActiveTrackIds].filter(id => availableTrackIds.has(id)))
      : availableTrackIds;

    for (const track of plan.tracks) {
      this.bufferCache.getOrCreate(track.take);
    }
    this.trackMixer.configureTracks(plan.tracks);
    this.horizonScheduler.replenish(plan, this.timeSource.currentTime(), this.activeTrackIds);
  }

  public getActivePlan(): PlaybackPlan | null {
    return this.activePlan;
  }

  public updatePlan(plan: PlaybackPlan): void {
    if (!this.activePlan) throw new Error('No playback session is active');
    this.validatePlan(plan);
    this.activePlan = plan;
    for (const track of plan.tracks) {
      this.bufferCache.getOrCreate(track.take);
    }
    this.trackMixer.configureTracks(plan.tracks);
  }

  public startTrack(trackId: string): void {
    if (!this.activePlan) throw new Error('No playback session is active');
    if (!this.activePlan.tracks.some(t => t.trackId === trackId)) return;
    if (this.activeTrackIds.has(trackId)) return;

    this.activeTrackIds.add(trackId);
    this.horizonScheduler.activateTrack(this.activePlan, trackId, this.timeSource.currentTime());
    this.horizonScheduler.replenish(this.activePlan, this.timeSource.currentTime(), this.activeTrackIds);
  }

  public stopTrack(trackId: string): void {
    if (!this.activePlan) return;

    this.activeTrackIds.delete(trackId);
    const sessionId = this.activePlan.playbackSessionId;
    this.audioScheduler.cancelWhere(e =>
      e.type === LOOP_ITERATION_EVENT_TYPE &&
      (e.payload as LoopIterationEventPayload).playbackSessionId === sessionId &&
      (e.payload as LoopIterationEventPayload).trackId === trackId
    );

    const sources = this.activeSources.get(trackId);
    if (sources) {
      sources.forEach(source => {
        source.stop();
        source.disconnect();
      });
      this.activeSources.delete(trackId);
    }
    this.horizonScheduler.deactivateTrack(trackId);
  }

  public isTrackPlaying(trackId: string): boolean {
    return this.activeTrackIds.has(trackId);
  }

  public hasActivePlayback(): boolean {
    return this.activePlan !== null && this.activeTrackIds.size > 0;
  }

  public replenish(): void {
    if (!this.activePlan || this.activeTrackIds.size === 0) return;
    this.horizonScheduler.replenish(this.activePlan, this.timeSource.currentTime(), this.activeTrackIds);
  }

  public schedule(event: ScheduledEvent): void {
    if (event.type !== LOOP_ITERATION_EVENT_TYPE) return;
    const payload = event.payload as LoopIterationEventPayload;
    if (!this.activePlan || payload.playbackSessionId !== this.activePlan.playbackSessionId) return;
    if (!this.activeTrackIds.has(payload.trackId)) return;
    this.executeLoopIteration(event.time, payload);
  }

  private executeLoopIteration(startTime: number, payload: LoopIterationEventPayload): void {
    const activeTrack = this.activePlan!.tracks.find(t => t.trackId === payload.trackId);
    if (!activeTrack || !this.activeTrackIds.has(payload.trackId)) return;

    const trackDest = this.trackMixer.getTrackDestination(payload.trackId);
    const buffer = this.bufferCache.getOrCreate(activeTrack.take);
    const source = this.adapter.createSourceNode(buffer);
    source.connect(trackDest);
    source.start(startTime);
    source.stop(startTime + payload.duration);

    let sources = this.activeSources.get(payload.trackId);
    if (!sources) {
      sources = new Set<ISourceNodeWrapper>();
      this.activeSources.set(payload.trackId, sources);
    }
    sources.add(source);

    source.onEnded(() => {
      sources!.delete(source);
      source.disconnect();
      if (sources!.size === 0) this.activeSources.delete(payload.trackId);
    });
  }

  public cancel(): void {
    if (!this.activePlan) return;

    const sessionId = this.activePlan.playbackSessionId;
    this.audioScheduler.cancelWhere(e =>
      e.type === LOOP_ITERATION_EVENT_TYPE &&
      (e.payload as LoopIterationEventPayload).playbackSessionId === sessionId
    );

    this.activeSources.forEach(sources => {
      sources.forEach(source => {
        source.stop();
        source.disconnect();
      });
    });
    this.activeSources.clear();
    this.activeTrackIds.clear();
    this.trackMixer.cleanup();
    this.horizonScheduler.reset();
    this.activePlan = null;
  }

  public stop(): void { this.cancel(); }

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
      const expectedDuration = track.take.frameCount / track.take.sampleRate;
      if (Math.abs(track.iterationDuration - expectedDuration) > 0.001) {
        throw new InvalidPlaybackPlanError(`iterationDuration ${track.iterationDuration} does not match take duration ${expectedDuration} for track ${track.trackId}`);
      }
      if (track.volume < 0.0 || track.volume > 1.0) throw new InvalidPlaybackPlanError(`Invalid volume for track ${track.trackId}`);
      if (track.pan < -1.0 || track.pan > 1.0) throw new InvalidPlaybackPlanError(`Invalid pan for track ${track.trackId}`);
    }
  }
}
