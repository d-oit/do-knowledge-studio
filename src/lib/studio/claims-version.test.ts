import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStudioStore } from './store'
import type { Claim } from './types'

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

describe('Claims version history', () => {
  beforeEach(() => {
    resetStore()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('new claim starts with version 1 and empty editHistory', () => {
    useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1' }))
    const claim = useStudioStore.getState().claims[0]
    expect(claim.version).toBe(1)
    expect(claim.editHistory).toEqual([])
  })

  it('updating statement increments version and adds to editHistory', () => {
    useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1', statement: 'Original' }))
    const claimId = useStudioStore.getState().claims[0].id

    vi.advanceTimersByTime(100)
    useStudioStore.getState().updateClaim(claimId, { statement: 'Updated' })

    const updated = useStudioStore.getState().claims[0]
    expect(updated.version).toBe(2)
    expect(updated.editHistory).toHaveLength(1)
    expect(updated.editHistory![0].statement).toBe('Original')
  })

  it('updating non-statement field increments version but does not add to editHistory', () => {
    useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1', statement: 'Test' }))
    const claimId = useStudioStore.getState().claims[0].id

    useStudioStore.getState().updateClaim(claimId, { confidence: 0.95 })

    const updated = useStudioStore.getState().claims[0]
    expect(updated.version).toBe(2)
    expect(updated.editHistory).toEqual([])
  })

  it('multiple statement updates accumulate editHistory', () => {
    useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1', statement: 'V1' }))
    const claimId = useStudioStore.getState().claims[0].id

    vi.advanceTimersByTime(100)
    useStudioStore.getState().updateClaim(claimId, { statement: 'V2' })

    vi.advanceTimersByTime(100)
    useStudioStore.getState().updateClaim(claimId, { statement: 'V3' })

    const updated = useStudioStore.getState().claims[0]
    expect(updated.version).toBe(3)
    expect(updated.editHistory).toHaveLength(2)
    expect(updated.editHistory![0].statement).toBe('V1')
    expect(updated.editHistory![1].statement).toBe('V2')
  })

  it('editHistory entries have editedAt timestamps', () => {
    useStudioStore.getState().addClaim(makeClaim({ entityId: 'e-1', statement: 'Original' }))
    const claimId = useStudioStore.getState().claims[0].id

    vi.advanceTimersByTime(100)
    useStudioStore.getState().updateClaim(claimId, { statement: 'Updated' })

    const updated = useStudioStore.getState().claims[0]
    expect(updated.editHistory![0].editedAt).toBeDefined()
    expect(typeof updated.editHistory![0].editedAt).toBe('string')
  })
})
