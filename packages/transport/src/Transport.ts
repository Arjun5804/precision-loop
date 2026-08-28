import { MusicalClock } from '@precision-loop/musical-clock';
import { AudioScheduler, ScheduledEvent } from '@precision-loop/audio-scheduler';
import { RecordingEngine, RecordedTake, AudioTime } from '@precision-loop/recording-engine';
import { TransportConfig, TransportPlan, TransportState, ClickEvent } from './types';
import { planSession, validateConfig } from './planner';
import { InvalidTransportStateError, InvalidConfigurationError, DependencyError, SessionCancelledError } from './errors';

export type TransportListener = (state: TransportState, plan: TransportPlan | null) => void;

export class Transport {
  private _state: TransportState = 'IDLE';
  private currentPlan: TransportPlan | null = null;
  private currentTake: RecordedTake | null = null;
  private generation: number = 0;
  private listeners: Set<TransportListener> = new Set();
  private transportId: string = crypto.randomUUID();
  
  private config: TransportConfig | null = null;

  constructor(
    private clock: MusicalClock,
    private scheduler: AudioScheduler,
    private recordingEngine: RecordingEngine
  ) {}

  public configure(config: TransportConfig): void {
    if (this._state !== 'IDLE') {
      throw new InvalidTransportStateError('Cannot configure while session is active', 'NOT_IDLE');
    }
    validateConfig(config);
    this.config = config;
  }

  public async start(sessionStartTime: AudioTime, workletUrl: string): Promise<void> {
    if (this._state !== 'IDLE') {
      throw new InvalidTransportStateError('Transport is not IDLE', 'NOT_IDLE');
    }
    if (!this.config) {
      throw new InvalidTransportStateError('Transport is not configured', 'NOT_CONFIGURED');
    }

    const currentGeneration = ++this.generation;
    const plan = planSession(this.config, this.clock, sessionStartTime);
    this.currentPlan = plan;
    this.currentTake = null;
    
    this.setState('ARMING');

    try {
      // 1. Prepare RecordingEngine
      await this.recordingEngine.prepare(workletUrl);

      // Verify concurrency
      if (this.generation !== currentGeneration) {
        throw new SessionCancelledError();
      }

      // 2. Schedule CLICK events through AudioScheduler
      for (const event of plan.countInEvents) {
        this.scheduler.schedule(this.mapToScheduledEvent(event, currentGeneration));
      }

      // 3. Arm RecordingEngine
      const takePromise = this.recordingEngine.arm(plan.recordingWindow);
      this.setState('ACTIVE');

      // 4. Await completion
      const take = await takePromise;

      // Verify concurrency
      if (this.generation !== currentGeneration) {
        throw new SessionCancelledError();
      }

      this.currentTake = take;
      this.setState('COMPLETED');
    } catch (err: unknown) {
      if (err instanceof SessionCancelledError) {
        throw err; // Expected cancellation, propagate without error state
      }
      
      // Concurrency check before changing state
      if (this.generation !== currentGeneration) {
        throw new SessionCancelledError();
      }

      // Error path cleanup
      this.generation++;
      for (const event of plan.countInEvents) {
        this.scheduler.cancel(this.getEventId(event, currentGeneration));
      }
      this.recordingEngine.cancel();
      this.currentPlan = null;
      this.currentTake = null;
      this.setState('ERROR');
      
      if (err instanceof InvalidTransportStateError || err instanceof InvalidConfigurationError) {
        throw err;
      }
      
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new DependencyError('Dependency failed during session', cause);
    }
  }

  public stop(): void {
    if (this._state === 'IDLE' || this._state === 'COMPLETED' || this._state === 'ERROR') {
      return;
    }

    const currentGeneration = this.generation;
    this.generation++; // invalidate pending async operations

    // Cancel scheduled click events using the tracked generation ID
    if (this.currentPlan) {
      for (const event of this.currentPlan.countInEvents) {
        this.scheduler.cancel(this.getEventId(event, currentGeneration));
      }
    }

    this.recordingEngine.cancel();
    this.currentPlan = null;
    this.currentTake = null;
    this.setState('IDLE');
  }

  /**
   * Dynamically finalizes an open-ended recording session at the specified audio time.
   */
  public finalize(endTime: AudioTime): void {
    console.log('DEBUG [Transport]: finalize() state:', this._state, 'endTime:', endTime);
    if (this._state !== 'ACTIVE') {
      return;
    }
    this.recordingEngine.finalize(endTime);
  }

  public getState(): TransportState {
    return this._state;
  }

  public getPlan(): TransportPlan | null {
    return this.currentPlan;
  }

  public getTake(): RecordedTake | null {
    return this.currentTake;
  }

  public subscribe(listener: TransportListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: TransportState): void {
    this._state = newState;
    for (const listener of this.listeners) {
      try {
        listener(this._state, this.currentPlan);
      } catch (err) {
        console.error('Transport listener threw an error', err);
      }
    }
  }

  private getEventId(click: ClickEvent, generation: number): string {
    return `click-${this.transportId}-gen${generation}-${click.barIndex}-${click.beatIndex}`;
  }

  private mapToScheduledEvent(click: ClickEvent, generation: number): ScheduledEvent {
    return {
      id: this.getEventId(click, generation),
      time: click.audioTime,
      type: 'CLICK',
      payload: {
        barIndex: click.barIndex,
        beatIndex: click.beatIndex,
        accent: click.accent,
      },
    };
  }
}
