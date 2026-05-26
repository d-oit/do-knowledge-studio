export type ErrorCode =
  | 'DB_INIT_FAILED' | 'DB_QUERY_FAILED' | 'DB_ERROR' | 'DB_NOT_READY'
  | 'SEARCH_FAILED' | 'EXPORT_FAILED' | 'LLM_FAILED' | 'WORKER_TIMEOUT'
  | 'VALIDATION_FAILED' | 'VALIDATION_ERROR' | 'OPERATION_FAILED'
  | 'NOT_FOUND' | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly context?: unknown,
    public readonly userMessage?: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
  }
}
