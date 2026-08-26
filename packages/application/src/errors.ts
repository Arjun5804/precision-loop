export class ApplicationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApplicationError';
    }
}

export class ApplicationStateError extends ApplicationError {
    constructor(message: string) {
        super(message);
        this.name = 'ApplicationStateError';
    }
}

export class ApplicationDependencyError extends ApplicationError {
    public readonly cause: Error;
    constructor(message: string, cause: Error) {
        super(message);
        this.name = 'ApplicationDependencyError';
        this.cause = cause;
    }
}
