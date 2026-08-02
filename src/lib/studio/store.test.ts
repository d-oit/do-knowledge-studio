import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStudioStore } from './store'
import type { Entity, Claim } from './types'
import { EntitySchema, ClaimSchema, ExportPayloadSchema, validatePersistedState } from './schema'

function resetStore() {
  useStudioStore.setState({
    entities: [],
    claims: [],
    chat: [],
    selectedEntityId: null,
    editingEntityId: null,
    currentView: 'home',
    searchQuery: '',
    typeFilter: 'all',
    sortBy: 'updated',
    sortDir: 'desc',
  })
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: `e-${Date.now().toString(36)}`,
    name: 'Test Entity',
    type: 'note',
    description: 'A test entity',
    content: '# Hello',
    tags: ['test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
    ...overrides,
  }
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: `c-${Date.now().toString(36)}`,
    entityId: 'e-1',
    statement: 'Test claim',
    confidence: 0.8,
    verification: 'unverified',
    ...overrides,
  }
}

describe('Studio Store', () => {
  beforeEach(() => {
    resetStore()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Entity CRUD', () => {
    it('creates a new entity via saveEntity', () => {
      const entity = makeEntity({ id: 'e-new' })
      useStudioStore.getState().saveEntity(entity)
      const { entities } = useStudioStore.getState()
      expect(entities).toHaveLength(1)
      expect(entities[0].id).toBe('e-new')
    })

    it('updates an existing entity via saveEntity', () => {
      const entity = makeEntity({ id: 'e-1', name: 'Original' })
      useStudioStore.getState().saveEntity(entity)
      useStudioStore.getState().saveEntity({ ...entity, name: 'Updated' })
      const { entities } = useStudioStore.getState()
      expect(entities).toHaveLength(1)
      expect(entities[0].name).toBe('Updated')
    })

    it('deletes an entity and its claims', () => {
      const entity = makeEntity({ id: 'e-1' })
      useStudioStore.getState().saveEntity(entity)
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1' }))
      useStudioStore.getState().deleteEntity('e-1')
      const { entities, claims } = useStudioStore.getState()
      expect(entities).toHaveLength(0)
      expect(claims).toHaveLength(0)
    })

    it('clears selectedEntityId when deleting the selected entity', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-1' }))
      useStudioStore.getState().selectEntity('e-1')
      useStudioStore.getState().deleteEntity('e-1')
      expect(useStudioStore.getState().selectedEntityId).toBeNull()
    })

    it('removes incoming links from other entities when deleting', () => {
      const target = makeEntity({ id: 'e-target', name: 'Target' })
      const source = makeEntity({
        id: 'e-source',
        name: 'Source',
        links: [{ targetId: 'e-target', relation: 'relates to' }],
      })
      useStudioStore.getState().saveEntity(target)
      useStudioStore.getState().saveEntity(source)
      useStudioStore.getState().deleteEntity('e-target')

      const { entities } = useStudioStore.getState()
      expect(entities).toHaveLength(1)
      expect(entities[0].id).toBe('e-source')
      expect(entities[0].links).toHaveLength(0)
    })

    it('preserves links to non-deleted entities', () => {
      const entityA = makeEntity({ id: 'e-a', name: 'A' })
      const entityB = makeEntity({
        id: 'e-b',
        name: 'B',
        links: [{ targetId: 'e-a', relation: 'relates to' }, { targetId: 'e-c', relation: 'depends on' }],
      })
      const entityC = makeEntity({ id: 'e-c', name: 'C' })
      useStudioStore.getState().saveEntity(entityA)
      useStudioStore.getState().saveEntity(entityB)
      useStudioStore.getState().saveEntity(entityC)
      useStudioStore.getState().deleteEntity('e-a')

      const remaining = useStudioStore.getState().entities
      const entityB2 = remaining.find((e) => e.id === 'e-b')
      expect(entityB2?.links).toHaveLength(1)
      expect(entityB2?.links[0].targetId).toBe('e-c')
    })

    it('startEdit sets editingEntityId and navigates to editor', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-1' }))
      useStudioStore.getState().startEdit('e-1')
      const state = useStudioStore.getState()
      expect(state.editingEntityId).toBe('e-1')
      expect(state.currentView).toBe('editor')
    })

    it('startEdit ignores non-existent entity', () => {
      useStudioStore.getState().startEdit('e-nonexistent')
      expect(useStudioStore.getState().editingEntityId).toBeNull()
    })

    it('startNew clears editingEntityId and navigates to editor', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-1' }))
      useStudioStore.getState().startEdit('e-1')
      useStudioStore.getState().startNew()
      const state = useStudioStore.getState()
      expect(state.editingEntityId).toBeNull()
      expect(state.currentView).toBe('editor')
    })
  })

  describe('Claims', () => {
    it('adds a claim with auto-generated id', () => {
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1' }))
      const { claims } = useStudioStore.getState()
      expect(claims).toHaveLength(1)
      expect(claims[0].id).toMatch(/^[0-9a-f-]{36}$/)
      expect(claims[0].entityId).toBe('e-1')
    })

    it('adds a claim with createdAt and updatedAt timestamps', () => {
      const before = new Date().toISOString()
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1' }))
      const after = new Date().toISOString()
      const { claims } = useStudioStore.getState()
      expect(claims[0].createdAt).toBeDefined()
      expect(claims[0].updatedAt).toBeDefined()
      expect(claims[0].createdAt! >= before).toBe(true)
      expect(claims[0].createdAt! <= after).toBe(true)
    })

    it('updates a claim and sets updatedAt', () => {
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1', statement: 'Original' }))
      const claimId = useStudioStore.getState().claims[0].id
      const originalUpdatedAt = useStudioStore.getState().claims[0].updatedAt

      vi.advanceTimersByTime(100)
      useStudioStore.getState().updateClaim(claimId, { statement: 'Updated' })
      const updated = useStudioStore.getState().claims[0]
      expect(updated.statement).toBe('Updated')
      expect(updated.updatedAt).toBeDefined()
      expect(updated.updatedAt! > originalUpdatedAt!).toBe(true)
    })

    it('deletes a claim', () => {
      useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1' }))
      const claimId = useStudioStore.getState().claims[0].id
      useStudioStore.getState().deleteClaim(claimId)
      expect(useStudioStore.getState().claims).toHaveLength(0)
    })
  })

  describe('Library controls', () => {
    it('setSearchQuery updates searchQuery', () => {
      useStudioStore.getState().setSearchQuery('hello')
      expect(useStudioStore.getState().searchQuery).toBe('hello')
    })

    it('setTypeFilter updates typeFilter', () => {
      useStudioStore.getState().setTypeFilter('concept')
      expect(useStudioStore.getState().typeFilter).toBe('concept')
    })

    it('setSortBy and setSortDir update sort state', () => {
      useStudioStore.getState().setSortBy('name')
      useStudioStore.getState().setSortDir('asc')
      const state = useStudioStore.getState()
      expect(state.sortBy).toBe('name')
      expect(state.sortDir).toBe('asc')
    })
  })

  describe('Navigation', () => {
    it('setView updates currentView', () => {
      useStudioStore.getState().setView('graph')
      expect(useStudioStore.getState().currentView).toBe('graph')
    })

    it('setCommandOpen toggles command palette', () => {
      useStudioStore.getState().setCommandOpen(true)
      expect(useStudioStore.getState().commandOpen).toBe(true)
    })

    it('setRightPanelOpen toggles right panel', () => {
      useStudioStore.getState().setRightPanelOpen(false)
      expect(useStudioStore.getState().rightPanelOpen).toBe(false)
    })
  })

  describe('Chat', () => {
    it('sendMessage adds a user message and assistant reply', () => {
      useStudioStore.getState().sendMessage('Hello there')
      const { chat } = useStudioStore.getState()
      expect(chat).toHaveLength(2)
      expect(chat[0].role).toBe('user')
      expect(chat[0].content).toBe('Hello there')
      expect(chat[1].role).toBe('assistant')
    })

    it('sendMessage adds an assistant reply synchronously', () => {
      useStudioStore.getState().saveEntity(
        makeEntity({ id: 'e-1', name: 'React Hooks', description: 'React hooks are functions' }),
      )
      useStudioStore.getState().sendMessage('Tell me about React Hooks')
      const { chat } = useStudioStore.getState()
      expect(chat).toHaveLength(2)
      expect(chat[0].role).toBe('user')
      expect(chat[1].role).toBe('assistant')
    })
  })

  describe('Import / Reset', () => {
    it('importData replaces entities and claims', () => {
      const entities = [makeEntity({ id: 'e-1' }), makeEntity({ id: 'e-2' })]
      const claims = [makeClaim({ entityId: 'e-1' })]
      useStudioStore.getState().importData(entities, claims)
      const state = useStudioStore.getState()
      expect(state.entities).toHaveLength(2)
      expect(state.claims).toHaveLength(1)
      expect(state.currentView).toBe('library')
    })

    it('resetStore restores seed defaults', () => {
      useStudioStore.getState().saveEntity(makeEntity({ id: 'e-custom' }))
      useStudioStore.getState().resetStore()
      const state = useStudioStore.getState()
      expect(state.entities.length).toBeGreaterThan(0)
      expect(state.selectedEntityId).toBeNull()
      expect(state.editingEntityId).toBeNull()
    })
  })

  describe('Mobile', () => {
    it('setMobileDrawerOpen toggles mobile drawer', () => {
      useStudioStore.getState().setMobileDrawerOpen(true)
      expect(useStudioStore.getState().mobileDrawerOpen).toBe(true)
    })

    it('setMobilePanelView switches panel view', () => {
      useStudioStore.getState().setMobilePanelView('search')
      expect(useStudioStore.getState().mobilePanelView).toBe('search')
    })
  })
})

describe('Zod Schemas', () => {
  describe('EntitySchema', () => {
    it('accepts a valid entity', () => {
      const result = EntitySchema.safeParse(makeEntity())
      expect(result.success).toBe(true)
    })

    it('rejects entity with empty id', () => {
      const result = EntitySchema.safeParse(makeEntity({ id: '' }))
      expect(result.success).toBe(false)
    })

    it('rejects entity with empty name', () => {
      const result = EntitySchema.safeParse(makeEntity({ name: '' }))
      expect(result.success).toBe(false)
    })

    it('rejects entity with invalid type', () => {
      const result = EntitySchema.safeParse(makeEntity({ type: 'invalid' }))
      expect(result.success).toBe(false)
    })

    it('rejects entity with non-array tags', () => {
      const result = EntitySchema.safeParse(makeEntity({ tags: 'not-array' }))
      expect(result.success).toBe(false)
    })
  })

  describe('ClaimSchema', () => {
    it('accepts a valid claim', () => {
      const result = ClaimSchema.safeParse(makeClaim())
      expect(result.success).toBe(true)
    })

    it('accepts a claim with timestamps', () => {
      const result = ClaimSchema.safeParse(makeClaim({
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }))
      expect(result.success).toBe(true)
    })

    it('accepts a claim without timestamps (backward compat)', () => {
      const claim = makeClaim()
      delete (claim as Record<string, unknown>).createdAt
      delete (claim as Record<string, unknown>).updatedAt
      const result = ClaimSchema.safeParse(claim)
      expect(result.success).toBe(true)
    })

    it('rejects claim with empty statement', () => {
      const result = ClaimSchema.safeParse(makeClaim({ statement: '' }))
      expect(result.success).toBe(false)
    })

    it('rejects claim with confidence out of range', () => {
      const result = ClaimSchema.safeParse(makeClaim({ confidence: 1.5 }))
      expect(result.success).toBe(false)
    })

    it('rejects claim with invalid verification', () => {
      const result = ClaimSchema.safeParse(makeClaim({ verification: 'bogus' }))
      expect(result.success).toBe(false)
    })
  })

  describe('ExportPayloadSchema', () => {
    it('accepts a valid export payload', () => {
      const result = ExportPayloadSchema.safeParse({
        version: 1,
        exportedAt: new Date().toISOString(),
        entities: [makeEntity()],
        claims: [makeClaim()],
      })
      expect(result.success).toBe(true)
    })

    it('rejects payload with missing claims array', () => {
      const result = ExportPayloadSchema.safeParse({
        version: 1,
        exportedAt: new Date().toISOString(),
        entities: [makeEntity()],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('validatePersistedState', () => {
    it('accepts valid persisted state with entities and claims', () => {
      const data = {
        version: 1,
        entities: [makeEntity()],
        claims: [makeClaim()],
      }
      const result = validatePersistedState(data)
      expect(result.success).toBe(true)
    })

    it('rejects persisted state with invalid entity fields', () => {
      const data = {
        version: 1,
        entities: [{ ...makeEntity(), id: '' }],
        claims: [],
      }
      const result = validatePersistedState(data)
      expect(result.success).toBe(false)
    })

    it('rejects persisted state with invalid claim confidence', () => {
      const data = {
        version: 1,
        entities: [makeEntity()],
        claims: [makeClaim({ confidence: 2.0 })],
      }
      const result = validatePersistedState(data)
      expect(result.success).toBe(false)
    })

    it('rejects non-object persisted state', () => {
      const result = validatePersistedState('not an object')
      expect(result.success).toBe(false)
    })

    it('rejects null persisted state', () => {
      const result = validatePersistedState(null)
      expect(result.success).toBe(false)
    })

    it('returns structured errors with path and message', () => {
      const data = {
        version: 1,
        entities: [{ ...makeEntity(), name: '' }],
        claims: [],
      }
      const result = validatePersistedState(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors[0]).toHaveProperty('path')
        expect(result.errors[0]).toHaveProperty('message')
      }
    })
  })
})
