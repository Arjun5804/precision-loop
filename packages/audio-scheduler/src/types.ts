export type AudioTime = number;

export interface AudioTimeSource {
  currentTime(): AudioTime;
}

export interface ScheduledEvent<TPayload = unknown> {
  id: string;
  time: AudioTime;
  type: string;
  payload: TPayload;
}

export interface AudioEventSink {
  schedule(event: ScheduledEvent): void;
}

export enum SchedulerState {
  STOPPED = 'STOPPED',
  RUNNING = 'RUNNING'
}

export interface TickResult {
  currentTime: AudioTime;
  windowEnd: AudioTime;
  scheduled: ScheduledEvent[];
  late: ScheduledEvent[];
}
