import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { EXIT_INTERNAL, EXIT_OK } from './exit-codes.js'
import { exitCodeForStreamError, installStreamGuard } from './streams.js'

describe('exitCodeForStreamError', () => {
  it('treats a broken pipe as pipeline success', () => {
    expect(exitCodeForStreamError(Object.assign(new Error('gone'), { code: 'EPIPE' }))).toBe(EXIT_OK)
  })

  it('maps other stream failures to internal', () => {
    expect(exitCodeForStreamError(Object.assign(new Error('bad'), { code: 'EIO' }))).toBe(EXIT_INTERNAL)
    expect(exitCodeForStreamError('not an error object')).toBe(EXIT_INTERNAL)
  })
})

describe('installStreamGuard', () => {
  it('exits on the async error event instead of leaving an uncaught EPIPE', () => {
    const stream = new EventEmitter()
    const exits: number[] = []
    installStreamGuard(stream, (code) => exits.push(code))
    stream.emit('error', Object.assign(new Error('gone'), { code: 'EPIPE' }))
    stream.emit('error', Object.assign(new Error('bad'), { code: 'EIO' }))
    expect(exits).toEqual([EXIT_OK, EXIT_INTERNAL])
  })
})
