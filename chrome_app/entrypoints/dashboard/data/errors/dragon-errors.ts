export type DragonErrorKind = 'validation' | 'network' | 'permission' | 'unknown';

export type DragonErrorDetails = Record<string, string | number | boolean | null | undefined>;

export class DragonError extends Error {
  readonly kind: DragonErrorKind;
  readonly details?: DragonErrorDetails;

  constructor(kind: DragonErrorKind, message: string, details?: DragonErrorDetails) {
    super(message);
    this.name = 'DragonError';
    this.kind = kind;
    this.details = details;
  }
}

export class ValidationError extends DragonError {
  constructor(message: string, details?: DragonErrorDetails) {
    super('validation', message, details);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends DragonError {
  constructor(message: string, details?: DragonErrorDetails) {
    super('network', message, details);
    this.name = 'NetworkError';
  }
}

export class PermissionError extends DragonError {
  constructor(message: string, details?: DragonErrorDetails) {
    super('permission', message, details);
    this.name = 'PermissionError';
  }
}

export class UnknownError extends DragonError {
  constructor(message = 'Невідома помилка Dragon House', details?: DragonErrorDetails) {
    super('unknown', message, details);
    this.name = 'UnknownError';
  }
}

export function toDragonError(error: unknown): DragonError {
  if (error instanceof DragonError) {
    return error;
  }

  if (error instanceof Error) {
    return new UnknownError(error.message);
  }

  return new UnknownError();
}
