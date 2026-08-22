import { describe, it, expect, beforeEach } from 'vitest'
import { useStudioStore } from '@/lib/studio/store'

const STORE_KEY = 'do-knowledge-studio-store'

describe('Store persistence integration', () => {
  beforeEach(() => {
    localStorage.clear()
    useStudioStore.setState(useStudioStore.getInitialState())
  })

  it('persists entities to localStorage', () => {
    const initialCount = useStudioStore.getState().entities.length
    const entity = {
      id: 'test-1',
      name: 'Integration Test Entity',
      type: 'note' as const,
      description: 'A test entity for integration testing',
      content: 'Test content',
      tags: ['test', 'integration'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    }

    useStudioStore.getState().commitEntity(entity)

    const stored = localStorage.getItem(STORE_KEY)
    expect(stored).toBeTruthy()

    const parsed = JSON.parse(stored!)
    expect(parsed.state.entities.length).toBe(initialCount + 1)
    const found = parsed.state.entities.find((e: { id: string }) => e.id === 'test-1')
    expect(found).toBeDefined()
    expect(found.name).toBe('Integration Test Entity')
  })

  it('persisted state is readable from localStorage', () => {
    const entity = {
      id: 'persist-1',
      name: 'Persisted Entity',
      type: 'concept' as const,
      description: 'Should be in localStorage',
      content: 'Content',
      tags: ['persist'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    }

    useStudioStore.getState().commitEntity(entity)

    const stored = localStorage.getItem(STORE_KEY)
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    const found = parsed.state.entities.find((e: { id: string }) => e.id === 'persist-1')
    expect(found).toBeDefined()
    expect(found.name).toBe('Persisted Entity')
    expect(found.tags).toEqual(['persist'])
  })

  it('deletes entity and persists the deletion', () => {
    const entity = {
      id: 'del-1',
      name: 'To Be Deleted',
      type: 'note' as const,
      description: '',
      content: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    }

    useStudioStore.getState().commitEntity(entity)
    expect(useStudioStore.getState().entities.some((e) => e.id === 'del-1')).toBe(true)

    useStudioStore.getState().deleteEntity('del-1')
    expect(useStudioStore.getState().entities.some((e) => e.id === 'del-1')).toBe(false)

    const stored = localStorage.getItem(STORE_KEY)
    const parsed = JSON.parse(stored!)
    expect(parsed.state.entities.some((e: { id: string }) => e.id === 'del-1')).toBe(false)
  })

  it('persists claims linked to entities', () => {
    const entity = {
      id: 'claim-entity',
      name: 'Entity with Claims',
      type: 'note' as const,
      description: '',
      content: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    }

    useStudioStore.getState().commitEntity(entity)
    useStudioStore.getState().addClaim({
      entityId: 'claim-entity',
      statement: 'Test claim',
      confidence: 0.9,
      verification: 'verified',
    })

    const stored = localStorage.getItem(STORE_KEY)
    const parsed = JSON.parse(stored!)
    const claim = parsed.state.claims.find((c: { entityId: string }) => c.entityId === 'claim-entity')
    expect(claim).toBeDefined()
    expect(claim.statement).toBe('Test claim')
  })

  it('persists view state changes', () => {
    useStudioStore.getState().setView('graph')
    expect(useStudioStore.getState().currentView).toBe('graph')

    const stored = localStorage.getItem(STORE_KEY)
    const parsed = JSON.parse(stored!)
    expect(parsed.state.currentView).toBe('graph')
  })

  it('persists filter state but never the search query', () => {
    useStudioStore.getState().setSearchQuery('test query')
    useStudioStore.getState().setTypeFilter('concept')

    const stored = localStorage.getItem(STORE_KEY)
    const parsed = JSON.parse(stored!)
    expect(parsed.state.typeFilter).toBe('concept')
    // Ephemeral: persisting it serialized the whole corpus per keystroke.
    expect(parsed.state.searchQuery).toBeUndefined()
  })

  it('history is excluded from persistence', () => {
    const entity = {
      id: 'hist-1',
      name: 'Original',
      type: 'note' as const,
      description: '',
      content: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    }

    useStudioStore.getState().commitEntity(entity)
    useStudioStore.getState().commitEntity({ ...entity, name: 'Modified' })

    const stored = localStorage.getItem(STORE_KEY)
    const parsed = JSON.parse(stored!)
    expect(parsed.state.entityHistory).toBeUndefined()
    expect(parsed.state.historyIndex).toBeUndefined()
  })
})
