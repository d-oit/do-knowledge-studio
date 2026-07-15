import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useFilteredEntities, useStudioStore } from './store'
import type { Entity } from './types'

const MOCK_ENTITY: Entity = {
  id: '1',
  name: 'A',
  type: 'note',
  description: 'Desc A',
  content: '',
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  links: [],
}

describe('useFilteredEntities performance', () => {
  beforeEach(() => {
    // Reset store to a clean state
    useStudioStore.setState({
      entities: [MOCK_ENTITY],
      searchQuery: '',
      typeFilter: 'all',
      sortBy: 'updated',
      sortDir: 'desc',
      currentView: 'home',
    })
  })

  it('returns the same array instance when unrelated store state changes', () => {
    const { result } = renderHook(() => useFilteredEntities())
    const firstResult = result.current

    // Change an unrelated state property
    act(() => {
      useStudioStore.getState().setView('editor')
    })

    const secondResult = result.current

    // Check for referential stability
    expect(firstResult).toBe(secondResult)
  })

  it('returns a new array instance when related store state changes (searchQuery)', () => {
    const { result } = renderHook(() => useFilteredEntities())
    const firstResult = result.current

    // Change a related state property
    act(() => {
      useStudioStore.getState().setSearchQuery('test')
    })

    const secondResult = result.current

    // Should be a different instance because of filter/sort logic
    expect(firstResult).not.toBe(secondResult)
  })

  it('returns a new array instance when entities change', () => {
    const { result } = renderHook(() => useFilteredEntities())
    const firstResult = result.current

    act(() => {
      useStudioStore.getState().saveEntity({
        ...MOCK_ENTITY,
        id: '2',
        name: 'B',
      })
    })

    const secondResult = result.current
    expect(firstResult).not.toBe(secondResult)
  })
})
