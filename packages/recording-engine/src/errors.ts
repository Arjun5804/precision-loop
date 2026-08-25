export class RecordingEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'RecordingEngineError';
  }
}

export class RecordingPermissionError extends RecordingEngineError {
  constructor(message = 'Microphone permission denied') {
    super(message, 'PERMISSION_DENIED');
  }
}

export class DeviceUnavailableError extends RecordingEngineError {
  constructor(message = 'Selected device is unavailable') {
    super(message, 'DEVICE_UNAVAILABLE');
  }
}

export class InvalidWindowError extends RecordingEngineError {
  constructor(message = 'Invalid recording window') {
    super(message, 'INVALID_WINDOW');
  }
}

export class InvalidStateError extends RecordingEngineError {
  constructor(message: string, code: string) {
    super(message, code);
  }
}

export class BufferLimitExceededError extends RecordingEngineError {
  constructor(message = 'Recording duration exceeded maximum limit') {
    super(message, 'BUFFER_LIMIT_EXCEEDED');
  }
}
