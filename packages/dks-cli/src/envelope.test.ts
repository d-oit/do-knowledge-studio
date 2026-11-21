import { describe, expect, it } from 'vitest'
import { exitCodeFor, failureEnvelope, okEnvelope } from './envelope.js'
import { EXIT_CONFLICT, EXIT_INTERNAL, EXIT_IO, EXIT_NOT_FOUND, EXIT_OK, EXIT_PERMISSION, EXIT_USAGE } from './exit-codes.js'
import { CLI_VERSION } from './version.js'

describe('ok envelope', () => {
  it('carries data, command name, and the CLI version', () => {
    const envelope = okEnvelope('search', { results: [] })
    expect(envelope.ok).toBe(true)
    expect(envelope.data).toEqual({ results: [] })
    expect(envelope.meta).toEqual({ command: 'search', version: CLI_VERSION })
  })

  it('preserves key order ok → data → meta', () => {
    expect(JSON.stringify(okEnvelope('index', []))).toBe(
      `{"ok":true,"data":[],"meta":{"command":"index","version":"${CLI_VERSION}"}}`,
    )
  })
})

describe('failure envelope', () => {
  it('carries code, message, and meta', () => {
    const envelope = failureEnvelope('entity', 'entity_not_found', 'unknown entity id "x"')
    expect(envelope.ok).toBe(false)
    expect(envelope.error.code).toBe('entity_not_found')
    expect(envelope.error.message).toBe('unknown entity id "x"')
    expect(envelope.meta.command).toBe('entity')
  })

  it('omits hint when absent', () => {
    const envelope = failureEnvelope('search', 'usage', 'no query')
    expect('hint' in envelope.error).toBe(false)
    expect(JSON.parse(JSON.stringify(envelope)).error).not.toHaveProperty('hint')
  })

  it('keeps hint when provided', () => {
    const envelope = failureEnvelope('search', 'usage', 'no query', 'try dks help')
    expect(envelope.error.hint).toBe('try dks help')
  })

  it('preserves key order ok → error → meta', () => {
    const parsed = JSON.parse(JSON.stringify(failureEnvelope('doctor', 'io', 'boom'))) as Record<string, unknown>
    expect(Object.keys(parsed)).toEqual(['ok', 'error', 'meta'])
  })
})

describe('exitCodeFor', () => {
  it('maps usage and validation to exit 2', () => {
    expect(exitCodeFor('usage')).toBe(EXIT_USAGE)
    expect(exitCodeFor('validation')).toBe(EXIT_USAGE)
  })

  it('maps every not-found family to exit 3', () => {
    expect(exitCodeFor('not_found')).toBe(EXIT_NOT_FOUND)
    expect(exitCodeFor('entity_not_found')).toBe(EXIT_NOT_FOUND)
    expect(exitCodeFor('path_not_found')).toBe(EXIT_NOT_FOUND)
  })

  it('maps conflict to 4', () => {
    expect(exitCodeFor('conflict')).toBe(EXIT_CONFLICT)
  })

  it('maps io to 5 and permission to 6', () => {
    expect(exitCodeFor('io')).toBe(EXIT_IO)
    expect(exitCodeFor('permission')).toBe(EXIT_PERMISSION)
  })

  it('maps internal to 7', () => {
    expect(exitCodeFor('internal')).toBe(EXIT_INTERNAL)
  })

  it('maps onto zero for no error path', () => {
    // (white-box: the switch is exhaustive; ok paths never call this)
    expect(EXIT_OK).toBe(0)
  })
})
