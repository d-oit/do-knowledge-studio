import { describe, it, expect } from 'vitest'
import { EditorDraftSchema, CURRENT_DRAFT_VERSION } from './draft-schema'
import type { EditorDraft } from './draft-schema'

const VALID_DRAFT: EditorDraft = {
  id: 'test-1',
  entityId: 'entity-1',
  name: 'Test',
  content: 'Hello',
  description: 'Desc',
  type: 'note',
  sourceUrl: 'https://example.com',
  tags: ['a', 'b'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  version: 1,
}

describe('EditorDraftSchema', () => {
  it('accepts a valid draft', () => {
    const result = EditorDraftSchema.safeParse(VALID_DRAFT)
    expect(result.success).toBe(true)
  })

  it('rejects empty id', () => {
    const result = EditorDraftSchema.safeParse({ ...VALID_DRAFT, id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const result = EditorDraftSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer version', () => {
    const result = EditorDraftSchema.safeParse({ ...VALID_DRAFT, version: 1.5 })
    expect(result.success).toBe(false)
  })

  it('rejects version below 1', () => {
    const result = EditorDraftSchema.safeParse({ ...VALID_DRAFT, version: 0 })
    expect(result.success).toBe(false)
  })

  it('accepts empty tags array', () => {
    const result = EditorDraftSchema.safeParse({ ...VALID_DRAFT, tags: [] })
    expect(result.success).toBe(true)
  })

  it('accepts null entityId', () => {
    const result = EditorDraftSchema.safeParse({ ...VALID_DRAFT, entityId: null })
    expect(result.success).toBe(true)
  })

  it('rejects non-array tags', () => {
    const result = EditorDraftSchema.safeParse({ ...VALID_DRAFT, tags: 'not-array' })
    expect(result.success).toBe(false)
  })
})

describe('CURRENT_DRAFT_VERSION', () => {
  it('is a positive integer', () => {
    expect(CURRENT_DRAFT_VERSION).toBeGreaterThanOrEqual(1)
    expect(Number.isInteger(CURRENT_DRAFT_VERSION)).toBe(true)
  })
})