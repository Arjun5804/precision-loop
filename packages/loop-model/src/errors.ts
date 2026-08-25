export class LoopModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoopModelError';
  }
}

export class InvalidStateError extends LoopModelError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateError';
  }
}

export class InvalidParameterError extends LoopModelError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidParameterError';
  }
}
