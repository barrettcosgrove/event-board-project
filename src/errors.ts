export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EventNotFoundError extends AppError {}
export class NotAuthorizedError extends AppError {}
export class InvalidEventStateError extends AppError {}
export class InvalidInputError extends AppError {}
export class InvalidRSVPError extends AppError {}