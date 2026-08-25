export class AudioEngineError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AudioEngineError';
  }
}

export class AudioContextInitializationError extends AudioEngineError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AudioContextInitializationError';
  }
}

export class AudioContextStateError extends AudioEngineError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AudioContextStateError';
  }
}

export class AudioDeviceError extends AudioEngineError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AudioDeviceError';
  }
}

export class AudioWorkletInitializationError extends AudioEngineError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AudioWorkletInitializationError';
  }
}

export class UnsupportedAudioFeatureError extends AudioEngineError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'UnsupportedAudioFeatureError';
  }
}
