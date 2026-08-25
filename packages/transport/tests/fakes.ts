import { vi } from 'vitest';
import type { AudioTimeSource, AudioEventSink, ScheduledEvent, AudioScheduler } from '@precision-loop/audio-scheduler';
import type { RecordingEngine, RecordingWindow, RecordedTake, RecordingConfig } from '@precision-loop/recording-engine';

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

// We mock AudioScheduler methods that Transport uses
export class FakeAudioScheduler {
  public scheduledEvents: ScheduledEvent[] = [];
  public cancelledIds: string[] = [];
  
  schedule(event: ScheduledEvent): void {
    this.scheduledEvents.push(event);
  }
  
  cancel(id: string): boolean {
    this.cancelledIds.push(id);
    this.scheduledEvents = this.scheduledEvents.filter(e => e.id !== id);
    return true;
  }
}

export class FakeRecordingEngine {
  public state = 'IDLE';
  public armedWindow: RecordingWindow | null = null;
  public preparedUrl: string | null = null;
  public isCancelled = false;

  public resolveArm: ((take: RecordedTake) => void) | null = null;
  public rejectArm: ((err: Error) => void) | null = null;

  async prepare(url: string): Promise<void> {
    this.state = 'READY';
    this.preparedUrl = url;
  }

  async arm(window: RecordingWindow): Promise<RecordedTake> {
    this.state = 'ARMED';
    this.armedWindow = window;
    
    return new Promise((resolve, reject) => {
      this.resolveArm = resolve;
      this.rejectArm = reject;
    });
  }

  cancel(): void {
    this.isCancelled = true;
    this.state = 'IDLE';
    if (this.rejectArm) {
      this.rejectArm(new Error('Cancelled'));
    }
  }

  // Helper for tests to complete a recording
  simulateCompletion(takeId: string = 'take-123'): void {
    if (this.resolveArm && this.armedWindow) {
      this.state = 'COMPLETED';
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
      this.state = 'ERROR';
      this.rejectArm(err);
    }
  }
}
