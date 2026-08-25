export class TransportError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TransportError';
  }
}

export class InvalidConfigurationError extends TransportError {
  constructor(message: string = 'Invalid transport configuration') {
    super(message, 'INVALID_CONFIGURATION');
    this.name = 'InvalidConfigurationError';
  }
}

export class InvalidTransportStateError extends TransportError {
  constructor(message: string, code: string = 'INVALID_STATE') {
    super(message, code);
    this.name = 'InvalidTransportStateError';
  }
}

export class DependencyError extends TransportError {
  constructor(message: string, public readonly cause?: Error) {
    super(message, 'DEPENDENCY_ERROR');
    this.name = 'DependencyError';
  }
}

export class SessionCancelledError extends TransportError {
  constructor(message: string = 'Session was cancelled') {
    super(message, 'SESSION_CANCELLED');
    this.name = 'SessionCancelledError';
  }
}
