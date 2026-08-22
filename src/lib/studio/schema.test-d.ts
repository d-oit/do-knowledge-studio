import { describe, it, expectTypeOf } from 'vitest'
import { validatePersistedState, validateImportPayload } from './schema'
import type { ValidatedPersistedEnvelope, ValidationError } from './schema'
import type { Entity } from './types'

/**
 * Compile-time contract tests for the studio validation layer. These files
 * are what the vitest typecheck phase actually checks — without at least
 * one, `typecheck.enabled` is inert (Plan 131 G7).
 */

describe('schema type contracts', () => {
  it('narrows validated persisted state', () => {
    const result = validatePersistedState({ entities: [], claims: [] })
    expectTypeOf(result).toEqualTypeOf<
      { success: true; data: ValidatedPersistedEnvelope } | { success: false; errors: ValidationError[] }
    >()
    if (result.success) {
      expectTypeOf(result.data.entities).toEqualTypeOf<Entity[]>()
      expectTypeOf(result.data.chat).toEqualTypeOf<import('./schema').ValidatedChatMessage[] | undefined>()
    } else {
      expectTypeOf(result.errors[0].path).toEqualTypeOf<string>()
      expectTypeOf(result.errors[0].message).toEqualTypeOf<string>()
    }
  })

  it('keeps export payloads structurally distinct from envelopes', () => {
    const importResult = validateImportPayload({})
    expectTypeOf(importResult.success).toEqualTypeOf<boolean>()
    if (importResult.success) {
      expectTypeOf(importResult.data.version).toEqualTypeOf<number>()
    }
  })
})
