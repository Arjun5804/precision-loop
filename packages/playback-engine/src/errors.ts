export class PlaybackEngineError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PlaybackEngineError';
  }
}

export class InvalidPlaybackPlanError extends PlaybackEngineError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPlaybackPlanError';
  }
}
