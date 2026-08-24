import { AudioTimeSource, AudioTime, AudioEventSink, ScheduledEvent } from '../src/types.js';

export class FakeAudioTimeSource implements AudioTimeSource {
  private time: AudioTime = 0;

  currentTime(): AudioTime {
    return this.time;
  }

  setCurrentTime(time: AudioTime): void {
    this.time = time;
  }
  
  advanceBy(amount: AudioTime): void {
    this.time += amount;
  }
}

export class TestAudioEventSink implements AudioEventSink {
  public scheduledEvents: ScheduledEvent[] = [];

  schedule(event: ScheduledEvent): void {
    this.scheduledEvents.push(event);
  }
  
  clear(): void {
    this.scheduledEvents = [];
  }
}
