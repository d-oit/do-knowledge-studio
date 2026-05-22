/**
 * Application-level error with a machine-readable code.
 * Used throughout the app for consistent error handling.
 */
export class AppError extends Error {
  constructor(
    override message: string,
    public code: string,
    public override cause?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** Standardized error codes for AppError instances. */
export const ErrorCodes = {
  DB_INIT_FAILED: 'DB_INIT_FAILED',
  DB_ERROR: 'DB_ERROR',
  DB_NOT_READY: 'DB_NOT_READY',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
} as const;

/** Union type of all valid error code strings. */
export type ErrorCode = keyof typeof ErrorCodes;
