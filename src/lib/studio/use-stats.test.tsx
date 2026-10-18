import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useStats, useStudioStore } from './store'
import { makeClaim, makeEntity } from './test-helpers'

const MOCK_ENTITY = makeEntity({
  id: 'e-1',
  name: 'Test Entity',
  description: 'Desc',
  content: '',
  tags: [],
})

const MOCK_CLAIM = makeClaim({
  id: 'c-1',
  entityId: 'e-1',
  statement: 'Test Claim',
  confidence: 1.0,
  verification: 'verified',
})

describe('useStats selector stability', () => {
  beforeEach(() => {
    useStudioStore.setState({
      entities: [MOCK_ENTITY],
      claims: [MOCK_CLAIM],
      searchQuery: '',
      typeFilter: 'all',
      sortBy: 'updated',
      sortDir: 'desc',
      currentView: 'home',
    })
  })

  it('returns the same stats object instance when unrelated store state changes', () => {
    const { result } = renderHook(() => useStats())
    const firstResult = result.current

    // Change an unrelated state property
    act(() => {
      useStudioStore.getState().setView('editor')
    })

    const secondResult = result.current

    // Check for referential stability
    expect(firstResult).toBe(secondResult)
  })

  it('returns a new stats object instance when entities change', () => {
    const { result } = renderHook(() => useStats())
    const firstResult = result.current

    act(() => {
      useStudioStore.getState().saveEntity({
        ...MOCK_ENTITY,
        id: 'e-2',
        name: 'Another Entity',
      })
    })

    const secondResult = result.current

    expect(firstResult).not.toBe(secondResult)
  })

  it('returns a new stats object instance when claims change', () => {
    const { result } = renderHook(() => useStats())
    const firstResult = result.current

    act(() => {
      useStudioStore.getState().addClaim({
        entityId: 'e-1',
        statement: 'New Claim',
        confidence: 0.9,
        verification: 'unverified',
      })
    })

    const secondResult = result.current

    expect(firstResult).not.toBe(secondResult)
  })
})
