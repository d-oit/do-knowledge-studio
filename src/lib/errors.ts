export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const ErrorCodes = {
  DB_INIT_FAILED: 'DB_INIT_FAILED',
  DB_ERROR: 'DB_ERROR',
  DB_NOT_READY: 'DB_NOT_READY',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
