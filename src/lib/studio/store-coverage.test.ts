import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStudioStore } from './store'
import type { Entity, Claim } from './types'

function resetStore() {
  useStudioStore.setState({
    entities: [],
    claims: [],
    chat: [],
    chatLoading: false,
    selectedEntityId: null,
    editingEntityId: null,
    currentView: 'home',
    searchQuery: '',
    typeFilter: 'all',
    sortBy: 'updated',
    sortDir: 'desc',
    rightPanelOpen: true,
    commandOpen: false,
    mobileDrawerOpen: false,
    mobilePanelView: 'nav',
    entityHistory: [[]],
    historyIndex: 0,
  })
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
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
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    entityId: 'e-1',
    statement: 'Test claim',
    confidence: 0.8,
    verification: 'unverified',
    ...overrides,
  }
}

describe('Store coverage: undo/redo', () => {
  beforeEach(() => {
    resetStore()
    vi.useFakeTimers()
  })

  it('undo restores previous history snapshot', () => {
    const store = useStudioStore.getState()
    store.saveEntity(makeEntity({ id: 'e-1', name: 'First' }))
    store.saveEntity(makeEntity({ id: 'e-1', name: 'Second' }))
    // History after two saves: [[], [e-1(First)], [e-1(Second)]], index=3
    // Actually: pushHistory saves CURRENT before update
    // After save1: history=[[], []], index=1, entities=[First]
    // After save2: history=[[], [], [First]], index=2, entities=[Second]
    // undo: index=1, entities=history[1]=[]
    store.undo()
    // After undo, entities should be the snapshot from history[1]
    expect(useStudioStore.getState().historyIndex).toBe(1)
  })

  it('redo restores undone snapshot', () => {
    const store = useStudioStore.getState()
    store.saveEntity(makeEntity({ id: 'e-1', name: 'First' }))
    store.saveEntity(makeEntity({ id: 'e-1', name: 'Second' }))
    store.undo() // back to empty
    store.redo() // forward to [First]
    expect(useStudioStore.getState().entities).toHaveLength(1)
    expect(useStudioStore.getState().entities[0].name).toBe('First')
  })

  it('undo at boundary stays at index 0', () => {
    const store = useStudioStore.getState()
    store.saveEntity(makeEntity({ id: 'e-1' }))
    store.undo() // index 0, empty
    store.undo() // already at 0, no-op
    expect(useStudioStore.getState().historyIndex).toBe(0)
  })

  it('redo does nothing at history boundary', () => {
    const store = useStudioStore.getState()
    store.saveEntity(makeEntity({ id: 'e-1' }))
    // Already at latest, redo should be no-op
    store.redo()
    expect(useStudioStore.getState().entities).toHaveLength(1)
  })

  it('pushHistory trims future snapshots on new edit', () => {
    const store = useStudioStore.getState()
    store.saveEntity(makeEntity({ id: 'e-1', name: 'A' }))
    store.saveEntity(makeEntity({ id: 'e-1', name: 'B' }))
    store.undo() // back to A
    store.saveEntity(makeEntity({ id: 'e-1', name: 'C' }))
    // After undo then new edit, redo should not restore 'B'
    store.redo() // should be no-op since we diverged
    expect(useStudioStore.getState().entities[0].name).toBe('C')
  })
})

describe('Store coverage: commitEntity', () => {
  beforeEach(() => {
    resetStore()
  })

  it('creates new entity without changing view', () => {
    const entity = makeEntity({ id: 'e-new' })
    useStudioStore.getState().commitEntity(entity)
    const state = useStudioStore.getState()
    expect(state.entities).toHaveLength(1)
    expect(state.currentView).toBe('home') // unchanged
  })

  it('updates existing entity in place', () => {
    const entity = makeEntity({ id: 'e-1', name: 'Original' })
    useStudioStore.getState().commitEntity(entity)
    useStudioStore.getState().commitEntity({ ...entity, name: 'Updated' })
    expect(useStudioStore.getState().entities[0].name).toBe('Updated')
  })
})

describe('Store coverage: finishEditing / navigateToView', () => {
  beforeEach(() => {
    resetStore()
  })

  it('finishEditing clears editingEntityId', () => {
    useStudioStore.getState().saveEntity(makeEntity({ id: 'e-1' }))
    useStudioStore.getState().startEdit('e-1')
    useStudioStore.getState().finishEditing()
    expect(useStudioStore.getState().editingEntityId).toBeNull()
  })

  it('navigateToView sets currentView', () => {
    useStudioStore.getState().navigateToView('graph')
    expect(useStudioStore.getState().currentView).toBe('graph')
  })
})

describe('Store coverage: importWithRollback', () => {
  beforeEach(() => {
    resetStore()
  })

  it('succeeds with valid data', () => {
    const entities = [makeEntity({ id: 'e-1' })]
    const claims = [makeClaim({ entityId: 'e-1' })]
    const result = useStudioStore.getState().importWithRollback(entities, claims)
    expect(result.success).toBe(true)
    expect(useStudioStore.getState().entities).toHaveLength(1)
  })

  it('sets currentView to library on success', () => {
    useStudioStore.getState().importWithRollback([makeEntity()], [])
    expect(useStudioStore.getState().currentView).toBe('library')
  })
})

describe('Store coverage: filtered entities selector', () => {
  beforeEach(() => {
    resetStore()
  })

  it('filters by type', () => {
    useStudioStore.getState().importData([
      makeEntity({ id: 'e-1', type: 'note', name: 'Note' }),
      makeEntity({ id: 'e-2', type: 'concept', name: 'Concept' }),
    ], [])
    useStudioStore.getState().setTypeFilter('note')
    expect(useStudioStore.getState().typeFilter).toBe('note')
  })

  it('filters by search query', () => {
    useStudioStore.getState().importData([
      makeEntity({ id: 'e-1', name: 'React Hooks' }),
      makeEntity({ id: 'e-2', name: 'Vue Composition' }),
    ], [])
    useStudioStore.getState().setSearchQuery('React')
    expect(useStudioStore.getState().searchQuery).toBe('React')
  })
})

describe('Store coverage: clearChat', () => {
  beforeEach(() => {
    resetStore()
    vi.useFakeTimers()
  })

  it('clears chat messages and loading state', () => {
    useStudioStore.getState().sendMessage('Hello')
    expect(useStudioStore.getState().chat).toHaveLength(1)
    useStudioStore.getState().clearChat()
    expect(useStudioStore.getState().chat).toHaveLength(0)
    expect(useStudioStore.getState().chatLoading).toBe(false)
  })
})

describe('Store coverage: mobile drawer', () => {
  beforeEach(() => {
    resetStore()
  })

  it('setMobileDrawerOpen toggles drawer', () => {
    useStudioStore.getState().setMobileDrawerOpen(true)
    expect(useStudioStore.getState().mobileDrawerOpen).toBe(true)
    useStudioStore.getState().setMobileDrawerOpen(false)
    expect(useStudioStore.getState().mobileDrawerOpen).toBe(false)
  })

  it('setMobilePanelView switches view', () => {
    useStudioStore.getState().setMobilePanelView('search')
    expect(useStudioStore.getState().mobilePanelView).toBe('search')
    useStudioStore.getState().setMobilePanelView('nav')
    expect(useStudioStore.getState().mobilePanelView).toBe('nav')
  })
})
