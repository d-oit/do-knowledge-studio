import { describe, it, expect } from 'vitest';
import { AppError } from '../errors';

describe('AppError', () => {
  it('creates error with message and code', () => {
    const error = new AppError('Something failed', 'DB_INIT_FAILED');
    expect(error.message).toBe('Something failed');
    expect(error.code).toBe('DB_INIT_FAILED');
    expect(error.name).toBe('AppError');
  });

  it('extends Error', () => {
    const error = new AppError('test', 'UNKNOWN');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('has default recoverable as false', () => {
    const error = new AppError('test', 'SEARCH_FAILED');
    expect(error.recoverable).toBe(false);
  });

  it('accepts optional context', () => {
    const ctx = { table: 'entities' };
    const error = new AppError('fail', 'DB_ERROR', ctx);
    expect(error.context).toBe(ctx);
  });

  it('accepts optional userMessage', () => {
    const error = new AppError('fail', 'LLM_FAILED', undefined, 'AI is unavailable');
    expect(error.userMessage).toBe('AI is unavailable');
  });

  it('accepts recoverable flag', () => {
    const error = new AppError('fail', 'WORKER_TIMEOUT', undefined, undefined, true);
    expect(error.recoverable).toBe(true);
  });

  it('has correct stack trace', () => {
    const error = new AppError('test', 'UNKNOWN');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });
});
