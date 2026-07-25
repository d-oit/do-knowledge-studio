import { describe, expect, it } from 'vitest'
import {
  ClaimSchema,
  EntitySchema,
  EntityTypeSchema,
  ExportPayloadSchema,
  PersistedEnvelopeSchema,
  VerificationStatusSchema,
  validateImportPayload,
  validatePersistedState,
} from './schema'

// ── EntityTypeSchema ────────────────────────────────────────────────

describe('EntityTypeSchema', () => {
  it.each(['note', 'concept', 'person', 'project'])('accepts %s', (val) => {
    expect(EntityTypeSchema.parse(val)).toBe(val)
  })

  it.each(['', 'NOTE', 'unknown', null, undefined, 42])('rejects %s', (val) => {
    expect(() => EntityTypeSchema.parse(val)).toThrow()
  })
})

// ── VerificationStatusSchema ────────────────────────────────────────

describe('VerificationStatusSchema', () => {
  it.each(['unverified', 'verified', 'disputed'])('accepts %s', (val) => {
    expect(VerificationStatusSchema.parse(val)).toBe(val)
  })

  it.each(['', 'pending', 'Verified', null, undefined])('rejects %s', (val) => {
    expect(() => VerificationStatusSchema.parse(val)).toThrow()
  })
})

// ── EntitySchema ────────────────────────────────────────────────────

const validEntity = {
  id: 'e1',
  name: 'Test',
  type: 'note' as const,
  description: 'desc',
  content: 'body',
  tags: ['a'],
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  links: [{ targetId: 'e2', relation: 'related' }],
}

describe('EntitySchema', () => {
  it('accepts a valid entity', () => {
    expect(EntitySchema.parse(validEntity)).toEqual(validEntity)
  })

  it('accepts valid sourceUrl', () => {
    expect(EntitySchema.parse({ ...validEntity, sourceUrl: 'https://example.com' }).sourceUrl).toBe(
      'https://example.com',
    )
  })

  it('rejects invalid sourceUrl', () => {
    expect(() =>
      EntitySchema.parse({ ...validEntity, sourceUrl: 'not-a-url' }),
    ).toThrow()
  })

  it('accepts missing sourceUrl', () => {
    const { sourceUrl: _, ...rest } = { ...validEntity, sourceUrl: undefined }
    expect(EntitySchema.parse(rest).sourceUrl).toBeUndefined()
  })

  it('rejects empty string id', () => {
    expect(() => EntitySchema.parse({ ...validEntity, id: '' })).toThrow()
  })

  it('rejects empty string name', () => {
    expect(() => EntitySchema.parse({ ...validEntity, name: '' })).toThrow()
  })

  it('accepts empty tags array', () => {
    expect(EntitySchema.parse({ ...validEntity, tags: [] }).tags).toEqual([])
  })

  it('accepts links with empty-string fields', () => {
    const entity = { ...validEntity, links: [{ targetId: '', relation: '' }] }
    expect(EntitySchema.parse(entity).links[0].targetId).toBe('')
  })

  it('rejects missing required fields', () => {
    expect(() => EntitySchema.parse({ id: 'e1' })).toThrow()
  })

  it('strips extra fields', () => {
    const extra = { ...validEntity, mystery: true }
    const parsed = EntitySchema.parse(extra)
    expect(parsed).not.toHaveProperty('mystery')
  })
})

// ── ClaimSchema ─────────────────────────────────────────────────────

const validClaim = {
  id: 'c1',
  entityId: 'e1',
  statement: 'The sky is blue',
  confidence: 0.8,
  verification: 'verified' as const,
}

describe('ClaimSchema', () => {
  it('accepts a valid claim with defaults', () => {
    const parsed = ClaimSchema.parse(validClaim)
    expect(parsed.version).toBe(1)
    expect(parsed.editHistory).toEqual([])
  })

  it('accepts confidence = 0', () => {
    expect(ClaimSchema.parse({ ...validClaim, confidence: 0 }).confidence).toBe(0)
  })

  it('accepts confidence = 1', () => {
    expect(ClaimSchema.parse({ ...validClaim, confidence: 1 }).confidence).toBe(1)
  })

  it.each([-0.001, 1.001, Number.NaN])('rejects confidence = %s', (val) => {
    expect(() => ClaimSchema.parse({ ...validClaim, confidence: val })).toThrow()
  })

  it.each([0, -1, 1.5])('rejects version = %s', (val) => {
    expect(() => ClaimSchema.parse({ ...validClaim, version: val })).toThrow()
  })

  it('accepts optional evidence and source', () => {
    const parsed = ClaimSchema.parse({ ...validClaim, evidence: 'ev', source: 'src' })
    expect(parsed.evidence).toBe('ev')
    expect(parsed.source).toBe('src')
  })

  it('accepts optional createdAt and updatedAt', () => {
    const parsed = ClaimSchema.parse({
      ...validClaim,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    })
    expect(parsed.createdAt).toBe('2025-01-01')
  })
})

// ── ExportPayloadSchema ─────────────────────────────────────────────

describe('ExportPayloadSchema', () => {
  const payload = {
    version: 1,
    exportedAt: '2025-01-01',
    entities: [validEntity],
    claims: [validClaim],
  }

  it('accepts valid payload', () => {
    expect(ExportPayloadSchema.parse(payload)).toBeDefined()
  })

  it('accepts version 0', () => {
    expect(ExportPayloadSchema.parse({ ...payload, version: 0 }).version).toBe(0)
  })

  it('accepts version -1', () => {
    expect(ExportPayloadSchema.parse({ ...payload, version: -1 }).version).toBe(-1)
  })

  it('accepts version 1.5', () => {
    expect(ExportPayloadSchema.parse({ ...payload, version: 1.5 }).version).toBe(1.5)
  })

  it('accepts empty arrays', () => {
    expect(ExportPayloadSchema.parse({ ...payload, entities: [], claims: [] })).toBeDefined()
  })

  it('rejects missing fields', () => {
    expect(() => ExportPayloadSchema.parse({ version: 1 })).toThrow()
  })

  it('rejects invalid entity in entities', () => {
    expect(() =>
      ExportPayloadSchema.parse({ ...payload, entities: [{ id: '' }] }),
    ).toThrow()
  })

  it('rejects invalid claim in claims', () => {
    expect(() =>
      ExportPayloadSchema.parse({ ...payload, claims: [{ id: 'c1' }] }),
    ).toThrow()
  })
})

// ── PersistedEnvelopeSchema ─────────────────────────────────────────

describe('PersistedEnvelopeSchema', () => {
  const envelope = {
    version: 1,
    entities: [validEntity],
    claims: [validClaim],
  }

  it('accepts version 1', () => {
    expect(PersistedEnvelopeSchema.parse(envelope).version).toBe(1)
  })

  it.each([0, -1, 1.5])('rejects version = %s', (val) => {
    expect(() => PersistedEnvelopeSchema.parse({ ...envelope, version: val })).toThrow()
  })

  it('accepts empty arrays', () => {
    expect(
      PersistedEnvelopeSchema.parse({ ...envelope, entities: [], claims: [] }),
    ).toBeDefined()
  })

  it('rejects missing version', () => {
    expect(() =>
      PersistedEnvelopeSchema.parse({ entities: [], claims: [] }),
    ).toThrow()
  })
})

// ── validatePersistedState ──────────────────────────────────────────

describe('validatePersistedState', () => {
  it('returns success for valid data', () => {
    const result = validatePersistedState({
      version: 1,
      entities: [validEntity],
      claims: [validClaim],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.version).toBe(1)
    }
  })

  it.each([null, undefined, 42, [1, 2], 'hello'])('returns errors for %s', (val) => {
    const result = validatePersistedState(val)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('collects multiple errors', () => {
    const result = validatePersistedState({ version: 'nope', entities: 'bad' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(1)
    }
  })

  it('includes nested paths in errors', () => {
    const result = validatePersistedState({
      version: 1,
      entities: [{ id: '', name: '', type: 'invalid' }],
      claims: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.errors.map((e) => e.path)
      expect(paths.some((p) => p.startsWith('entities.'))).toBe(true)
    }
  })
})

// ── validateImportPayload ───────────────────────────────────────────

describe('validateImportPayload', () => {
  const payload = {
    version: 1,
    exportedAt: '2025-01-01',
    entities: [validEntity],
    claims: [validClaim],
  }

  it('returns success for valid payload', () => {
    const result = validateImportPayload(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.exportedAt).toBe('2025-01-01')
    }
  })

  it.each([null, undefined, 42, 'hello'])('returns errors for %s', (val) => {
    const result = validateImportPayload(val)
    expect(result.success).toBe(false)
  })

  it('returns errors for invalid entity', () => {
    const result = validateImportPayload({
      ...payload,
      entities: [{ id: '', name: '', type: 'bad' }],
    })
    expect(result.success).toBe(false)
  })

  it('returns errors for invalid claim', () => {
    const result = validateImportPayload({
      ...payload,
      claims: [{ id: '', entityId: '', statement: '', confidence: 5, verification: 'nope' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts version 0', () => {
    const result = validateImportPayload({ ...payload, version: 0 })
    expect(result.success).toBe(true)
  })

  it('accepts version -1', () => {
    const result = validateImportPayload({ ...payload, version: -1 })
    expect(result.success).toBe(true)
  })

  it('accepts version 1.5', () => {
    const result = validateImportPayload({ ...payload, version: 1.5 })
    expect(result.success).toBe(true)
  })
})
