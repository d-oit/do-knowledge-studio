import { describe, it, expect } from 'vitest'
import { AppError, ErrorCode } from './errors'

describe('AppError', () => {
  it('sets code and user message from error code', () => {
    const err = new AppError(ErrorCode.ENTITY_NOT_FOUND)
    expect(err.code).toBe(ErrorCode.ENTITY_NOT_FOUND)
    expect(err.userMessage).toBe('The requested entity could not be found.')
    expect(err.message).toBe('The requested entity could not be found.')
    expect(err.name).toBe('AppError')
  })

  it('uses custom message when provided', () => {
    const err = new AppError(ErrorCode.UNKNOWN, 'Custom detail')
    expect(err.message).toBe('Custom detail')
    expect(err.userMessage).toBe('An unexpected error occurred.')
  })

  it('preserves cause via ErrorOptions', () => {
    const cause = new Error('root')
    const err = new AppError(ErrorCode.STORAGE_READ_FAILED, undefined, { cause })
    expect(err.cause).toBe(cause)
  })

  it('toUserString returns user-facing message', () => {
    const err = new AppError(ErrorCode.AI_PROVIDER_RATE_LIMITED, 'rate limit 429')
    expect(err.toUserString()).toBe('Too many requests. Please wait a moment and try again.')
  })

  it('is instanceof Error', () => {
    const err = new AppError(ErrorCode.EXPORT_FAILED)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
  })
})
