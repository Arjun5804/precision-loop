import { vi } from 'vitest';
import { AudioScheduler } from '@precision-loop/audio-scheduler';
import { RecordingEngine } from '@precision-loop/recording-engine';
import type { AudioTimeSource, AudioEventSink, ScheduledEvent } from '@precision-loop/audio-scheduler';
import type { RecordingWindow, RecordedTake, RecordingConfig } from '@precision-loop/recording-engine';

export class FakeAudioTimeSource implements AudioTimeSource {
  public time: number = 0;
  currentTime(): number {
    return this.time;
  }
}

export class FakeAudioEventSink implements AudioEventSink {
  public events: ScheduledEvent[] = [];
  schedule(event: ScheduledEvent): void {
    this.events.push(event);
  }
}

// We mock AudioScheduler methods that Transport uses by extending it
export class FakeAudioScheduler extends AudioScheduler {
  public scheduledEvents: ScheduledEvent[] = [];
  public cancelledIds: string[] = [];
  
  // Custom property to trigger scheduling failures in tests
  public failOnScheduleCount: number = -1;
  private scheduleCalls: number = 0;

  constructor() {
    super(new FakeAudioTimeSource(), new FakeAudioEventSink());
  }
  
  override schedule(event: ScheduledEvent): void {
    this.scheduleCalls++;
    if (this.failOnScheduleCount !== -1 && this.scheduleCalls >= this.failOnScheduleCount) {
      throw new Error('Simulated schedule failure');
    }
    this.scheduledEvents.push(event);
  }
  
  override cancel(id: string): boolean {
    this.cancelledIds.push(id);
    this.scheduledEvents = this.scheduledEvents.filter(e => e.id !== id);
    return true;
  }
}

export class FakeRecordingEngine extends RecordingEngine {
  public mockState = 'IDLE';
  public armedWindow: RecordingWindow | null = null;
  public preparedUrl: string | null = null;
  public isCancelled = false;

  public resolveArm: ((take: RecordedTake) => void) | null = null;
  public rejectArm: ((err: Error) => void) | null = null;

  constructor() {
    // Pass a dummy AudioContext since we override all used methods
    super({} as AudioContext);
  }

  override async prepare(url: string): Promise<void> {
    this.mockState = 'READY';
    this.preparedUrl = url;
  }

  override async arm(window: RecordingWindow): Promise<RecordedTake> {
    this.mockState = 'ARMED';
    this.armedWindow = window;
    
    return new Promise((resolve, reject) => {
      this.resolveArm = resolve;
      this.rejectArm = reject;
    });
  }

  override cancel(): void {
    this.isCancelled = true;
    this.mockState = 'IDLE';
    if (this.rejectArm) {
      this.rejectArm(new Error('Cancelled'));
    }
  }

  // Helper for tests to complete a recording
  simulateCompletion(takeId: string = 'take-123'): void {
    if (this.resolveArm && this.armedWindow) {
      this.mockState = 'COMPLETED';
      this.resolveArm({
        id: takeId,
        sampleRate: 48000,
        channelCount: 1,
        frameCount: 48000, // mock frame count
        channels: [new Float32Array(10)],
        startTime: this.armedWindow.startTime,
        endTime: this.armedWindow.endTime,
      });
    }
  }

  simulateError(err: Error): void {
    if (this.rejectArm) {
      this.mockState = 'ERROR';
      this.rejectArm(err);
    }
  }
}
