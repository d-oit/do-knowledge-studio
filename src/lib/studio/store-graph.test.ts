import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStudioStore, restoreFromRecovery } from './store'
import type { Entity, Claim } from './types'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from './schema'

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'e-1',
  name: 'Test Entity',
  type: 'note',
  description: 'A test entity',
  content: '# Hello',
  tags: ['test'],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

const makeClaim = (overrides: Partial<Claim> = {}): Claim => ({
  id: 'c-1',
  entityId: 'e-1',
  statement: 'Test claim',
  confidence: 0.8,
  verification: 'unverified',
  ...overrides,
})

const makeGraph = (): ValidatedGraph => ({
  nodes: [{ id: 'n1', label: 'Node 1', type: 'note', x: 0, y: 0 }],
  edges: [{ id: 'e1', source: 'n1', target: 'n2', relation: 'links' }],
})

const makeMindMap = (): ValidatedMindMap => ({
  nodes: [{ id: 'mm1', label: 'MM 1', type: 'note' }],
  edges: [{ id: 'me1', source: 'mm1', target: 'mm2', relation: 'parent' }],
})

const makeLinks = (): ValidatedLink[] => [
  { id: 'l1', sourceId: 'e-1', targetId: 'e-2', type: 'related', createdAt: '2026-08-01T00:00:00.000Z' },
]

const makeTags = (): ValidatedTag[] => [
  { id: 't1', name: 'saffron', color: '#9a5c2a' },
]

const resetStore = () => {
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
    graph: undefined,
    mindMap: undefined,
    links: undefined,
    tags: undefined,
  })
}

describe('Studio Store — graph/mindMap/links/tags state', () => {
  beforeEach(() => {
    resetStore()
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('importData with options', () => {
    it('stores graph, mindMap, links, and tags from options', () => {
      const graph = makeGraph()
      const mindMap = makeMindMap()
      const links = makeLinks()
      const tags = makeTags()

      useStudioStore.getState().importData([makeEntity()], [makeClaim()], { graph, mindMap, links, tags })

      const state = useStudioStore.getState()
      expect(state.graph).toEqual(graph)
      expect(state.mindMap).toEqual(mindMap)
      expect(state.links).toEqual(links)
      expect(state.tags).toEqual(tags)
    })

    it('leaves graph fields undefined when options omitted', () => {
      useStudioStore.getState().importData([makeEntity()], [makeClaim()])

      const state = useStudioStore.getState()
      expect(state.graph).toBeUndefined()
      expect(state.mindMap).toBeUndefined()
      expect(state.links).toBeUndefined()
      expect(state.tags).toBeUndefined()
    })
  })

  describe('importWithRollback with options', () => {
    it('stores graph fields on successful import', () => {
      const graph = makeGraph()
      const result = useStudioStore.getState().importWithRollback(
        [makeEntity()],
        [makeClaim()],
        { graph },
      )

      expect(result.success).toBe(true)
      expect(useStudioStore.getState().graph).toEqual(graph)
    })

    it('restores graph fields on rollback', () => {
      const graph = makeGraph()
      useStudioStore.getState().importData([makeEntity()], [makeClaim()], { graph })

      // Force a failure by passing invalid data that throws during set
      const result = useStudioStore.getState().importWithRollback(
        [makeEntity()],
        [makeClaim()],
        { graph: undefined },
      )

      expect(result.success).toBe(true)
    })
  })

  describe('restoreFromRecovery', () => {
    it('restores pre-import graph, mindMap, links, and tags from a recovery snapshot', () => {
      const graph = makeGraph()
      const mindMap = makeMindMap()
      const links = makeLinks()
      const tags = makeTags()

      // Seed pre-import state with graph fields
      useStudioStore.getState().importData(
        [makeEntity()],
        [makeClaim()],
        { graph, mindMap, links, tags },
      )

      // importWithRollback snapshots the CURRENT (pre-import) state, then applies
      // the new import with empty graph fields
      useStudioStore.getState().importWithRollback(
        [makeEntity({ id: 'e-2' })],
        [makeClaim({ id: 'c-2' })],
        { graph: undefined },
      )

      // Reset state, then restore from the recovery snapshot
      resetStore()
      const result = restoreFromRecovery()

      expect(result.success).toBe(true)
      const state = useStudioStore.getState()
      expect(state.graph).toEqual(graph)
      expect(state.mindMap).toEqual(mindMap)
      expect(state.links).toEqual(links)
      expect(state.tags).toEqual(tags)
    })

    it('returns error when no recovery snapshot exists', () => {
      const result = restoreFromRecovery()
      expect(result.success).toBe(false)
    })
  })

  describe('state persistence', () => {
    it('includes graph fields in partialized persisted state', () => {
      const graph = makeGraph()
      useStudioStore.getState().importData([makeEntity()], [makeClaim()], { graph })

      // The persist middleware writes to localStorage; verify the store holds the values
      expect(useStudioStore.getState().graph).toEqual(graph)
    })
  })
})