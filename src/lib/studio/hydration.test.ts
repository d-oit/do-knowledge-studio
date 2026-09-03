import { describe, it, expect } from 'vitest'
import {
  sanitizeHydration,
  migratePersistedState,
  partializePersistedState,
  mergeHydratedState,
  HydrationRejectedError,
} from './hydration'
import type { Entity, Claim } from './types'

const SAMPLE_ENTITY: Entity = {
  id: 'ent-1',
  name: 'Test Entity',
  type: 'note',
  description: 'Test Description',
  content: 'Test Content',
  tags: ['test'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
}

const SAMPLE_CLAIM: Claim = {
  id: 'claim-1',
  entityId: 'ent-1',
  statement: 'Test statement',
  confidence: 0.9,
  verification: 'unverified',
  version: 1,
  editHistory: [],
}

const createValidPersistedSlice = () => ({
  entities: [SAMPLE_ENTITY],
  claims: [SAMPLE_CLAIM],
  chat: [],
  currentView: 'library' as const,
  typeFilter: 'all' as const,
  sortBy: 'updated' as const,
  sortDir: 'desc' as const,
  rightPanelOpen: true,
})

describe('sanitizeHydration', () => {
  it('rejects non-object inputs', () => {
    const invalidInputs = [
      null,
      undefined,
      123,
      'invalid string',
      true,
      ['an', 'array'],
    ]

    invalidInputs.forEach((input) => {
      const verdict = sanitizeHydration(input)
      expect(verdict).toEqual({
        ok: false,
        data: {},
        reason: 'payload is not an object',
      })
    })
  })

  it('accepts valid persisted state and strips envelope version metadata', () => {
    const validSlice = createValidPersistedSlice()
    const inputWithVersion = { ...validSlice, version: 5 }

    const verdict = sanitizeHydration(inputWithVersion)

    expect(verdict.ok).toBe(true)
    expect(verdict.reason).toBeUndefined()
    expect(verdict.data).toEqual(validSlice)
    expect('version' in verdict.data).toBe(false)
  })

  it('rejects state with invalid entity structure and formats error reason with path', () => {
    const invalidSlice = {
      ...createValidPersistedSlice(),
      entities: [
        {
          ...SAMPLE_ENTITY,
          type: 'invalid-type', // Invalid entity type enum
        },
      ],
    }

    const verdict = sanitizeHydration(invalidSlice)

    expect(verdict.ok).toBe(false)
    expect(verdict.data).toEqual({})
    expect(verdict.reason).toContain('entities.0.type')
  })

  it('rejects state with invalid claim structure and formats path', () => {
    const invalidSlice = {
      ...createValidPersistedSlice(),
      claims: [
        {
          ...SAMPLE_CLAIM,
          confidence: 1.5, // Exceeds max 1.0
        },
      ],
    }

    const verdict = sanitizeHydration(invalidSlice)

    expect(verdict.ok).toBe(false)
    expect(verdict.data).toEqual({})
    expect(verdict.reason).toContain('claims.0.confidence')
  })

  it('rejects state with invalid currentView enum', () => {
    const invalidSlice = {
      ...createValidPersistedSlice(),
      currentView: 'non-existent-view',
    }

    const verdict = sanitizeHydration(invalidSlice)

    expect(verdict.ok).toBe(false)
    expect(verdict.data).toEqual({})
    expect(verdict.reason).toContain('currentView')
  })

  it('accepts valid optional fields such as graph, mindMap, links, and tags', () => {
    const sliceWithOptionals = {
      ...createValidPersistedSlice(),
      graph: {
        nodes: [{ id: 'ent-1', label: 'Node 1', type: 'note' as const, x: 0, y: 0 }],
        edges: [],
      },
      mindMap: {
        nodes: [{ id: 'ent-1', label: 'Mind Node 1', type: 'note' as const }],
        edges: [],
      },
      links: [
        {
          id: 'link-1',
          sourceId: 'ent-1',
          targetId: 'ent-2',
          type: 'relates_to',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tags: [{ id: 'tag-1', name: 'Important', color: '#ff0000' }],
    }

    const verdict = sanitizeHydration(sliceWithOptionals)

    expect(verdict.ok).toBe(true)
    expect(verdict.data).toEqual(sliceWithOptionals)
  })
})

describe('migratePersistedState', () => {
  it('migrates legacy envelope successfully', () => {
    const legacyState = {
      entities: [
        {
          id: 'e1',
          name: 'Legacy Note',
          type: 'note',
          description: '',
          content: '',
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ],
      claims: [],
      version: 1,
    }

    const result = migratePersistedState(legacyState, 1)
    expect(result.entities[0]?.id).toBe('e1')
    expect(result.entities[0]?.tags).toEqual([])
  })

  it('throws HydrationRejectedError when migration fails or version is unsupported', () => {
    expect(() => migratePersistedState({}, 9999)).toThrow(HydrationRejectedError)
    expect(() => migratePersistedState({}, 9999)).toThrow(
      'Persisted state rejected: no safe migration from version 9999; payload preserved on disk',
    )
  })
})

describe('partializePersistedState', () => {
  it('picks only persisted fields from state', () => {
    const fullState = {
      ...createValidPersistedSlice(),
      searchQuery: 'ephemeral search query',
      selectedEntityId: 'ent-1',
      commandPaletteOpen: true,
    }

    const partial = partializePersistedState(fullState as ReturnType<typeof createValidPersistedSlice>)

    expect(partial).toEqual(createValidPersistedSlice())
    expect('searchQuery' in partial).toBe(false)
    expect('selectedEntityId' in partial).toBe(false)
  })
})

describe('mergeHydratedState', () => {
  it('merges valid persisted payload into current state and resets history baseline', () => {
    const currentSeedState = {
      ...createValidPersistedSlice(),
      entities: [],
      entityHistory: [[]],
      historyIndex: 0,
    }

    const persisted = createValidPersistedSlice()

    const merged = mergeHydratedState(persisted, currentSeedState)

    expect(merged.entities).toEqual(persisted.entities)
    expect(merged.historyIndex).toBe(0)
    expect(merged.entityHistory).toHaveLength(1)
    expect(merged.entityHistory[0]).not.toBe(merged.entities) // Shallow copy clone check
    expect(merged.entityHistory[0]).toEqual(merged.entities)
  })

  it('throws HydrationRejectedError on invalid persisted payload during merge', () => {
    const currentSeedState = {
      ...createValidPersistedSlice(),
      entityHistory: [[]],
      historyIndex: 0,
    }

    const invalidPersisted = { invalid: true }

    expect(() => mergeHydratedState(invalidPersisted, currentSeedState)).toThrow(
      HydrationRejectedError,
    )
  })
})
