import { 
  AudioTimeSource, 
  AudioEventSink, 
  ScheduledEvent, 
  SchedulerState, 
  TickResult 
} from './types.js';
import { EventQueue } from './event-queue.js';
import { 
  InvalidLookaheadError, 
  InvalidSchedulerStateError,
  InvalidAudioTimeError,
  DuplicateEventIdError,
  InvalidEventError
} from './errors.js';

export interface AudioSchedulerConfig {
  /** The lookahead window in seconds. Defaults to 0.100 */
  lookahead?: number;
}

export class AudioScheduler {
  private state: SchedulerState = SchedulerState.STOPPED;
  private queue = new EventQueue();
  private lookahead: number;
  
  // Track all IDs to prevent duplicate submissions or re-additions globally
  private knownEventIds = new Set<string>();

  constructor(
    private timeSource: AudioTimeSource,
    private sink: AudioEventSink,
    config: AudioSchedulerConfig = {}
  ) {
    this.lookahead = config.lookahead ?? 0.100;
    
    if (typeof this.lookahead !== 'number' || isNaN(this.lookahead) || this.lookahead < 0 || !isFinite(this.lookahead)) {
      throw new InvalidLookaheadError('Lookahead must be a finite, non-negative number.');
    }
  }

  get currentState(): SchedulerState {
    return this.state;
  }

  start(): void {
    this.state = SchedulerState.RUNNING;
  }

  stop(): void {
    this.state = SchedulerState.STOPPED;
  }

  schedule(event: ScheduledEvent): void {
    if (typeof event.time !== 'number' || isNaN(event.time) || !isFinite(event.time) || event.time < 0) {
      throw new InvalidAudioTimeError('Event time must be a finite, non-negative number.');
    }
    if (!event.id) {
      throw new InvalidEventError('Event ID cannot be empty.');
    }
    if (!event.type) {
      throw new InvalidEventError('Event type cannot be empty.');
    }
    
    if (this.knownEventIds.has(event.id)) {
      throw new DuplicateEventIdError(event.id);
    }
    
    this.knownEventIds.add(event.id);
    this.queue.add(event);
  }

  cancel(eventId: string): boolean {
    return this.queue.remove(eventId);
  }

  cancelAll(): void {
    this.queue.removeAll();
  }

  tick(): TickResult {
    const currentTime = this.timeSource.currentTime();
    
    if (typeof currentTime !== 'number' || isNaN(currentTime) || !isFinite(currentTime) || currentTime < 0) {
      throw new InvalidAudioTimeError('Invalid audio time returned from source.');
    }

    const windowEnd = currentTime + this.lookahead;

    const result: TickResult = {
      currentTime,
      windowEnd,
      scheduled: [],
      late: []
    };

    if (this.state === SchedulerState.STOPPED) {
      return result;
    }

    while (true) {
      const nextEvent = this.queue.peek();
      if (!nextEvent || nextEvent.time > windowEnd) {
        break;
      }

      // Remove from queue
      const event = this.queue.pop()!;

      // Check if late (strictly before current time)
      if (event.time < currentTime) {
        result.late.push(event);
      } else {
        // Schedule it
        this.sink.schedule(event);
        result.scheduled.push(event);
      }
    }

    return result;
  }
}
