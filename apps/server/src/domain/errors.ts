import type { ErrorCode } from '@lifeline/shared';

/**
 * Base class for all typed domain/application errors. The HTTP error handler
 * maps these 1:1 onto RFC 7807 problem+json responses (status + stable code).
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly detail: string | undefined;

  constructor(status: number, code: ErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export class NotFoundError extends AppError {
  constructor(detail = 'Resource not found') {
    super(404, 'not_found', detail);
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = 'Forbidden') {
    super(403, 'forbidden', detail);
  }
}

export class ConflictError extends AppError {
  constructor(detail = 'Conflict') {
    super(409, 'conflict', detail);
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = 'Unauthorized') {
    super(401, 'unauthorized', detail);
  }
}

export class DomainValidationError extends AppError {
  /** Optional per-field messages, surfaced under `errors` in the problem body. */
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(detail: string, fieldErrors?: Record<string, string[]>) {
    super(400, 'validation_failed', detail);
    this.fieldErrors = fieldErrors;
  }
}
