export class DuplicateEventIdError extends Error {
  constructor(id: string) {
    super(`Event with ID "${id}" already exists.`);
    this.name = 'DuplicateEventIdError';
  }
}

export class InvalidAudioTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAudioTimeError';
  }
}

export class InvalidLookaheadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLookaheadError';
  }
}

export class InvalidEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventError';
  }
}

export class InvalidSchedulerStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSchedulerStateError';
  }
}
