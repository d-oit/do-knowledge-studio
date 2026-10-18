import { renderHook, act, waitFor } from '@testing-library/react'
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

/** Corpus for the ranked-query tests: distinct names and distinct timestamps. */
const ALPHA_ENTITY: Entity = {
  ...MOCK_ENTITY,
  id: 'alpha-1',
  name: 'Alpha',
  description: 'First entry',
  updatedAt: '2026-02-01T00:00:00.000Z',
}

const BETA_ENTITY: Entity = {
  ...MOCK_ENTITY,
  id: 'beta-1',
  name: 'Beta',
  description: 'Second entry',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('useFilteredEntities', () => {
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

  it('returns a new array instance when related store state changes (searchQuery)', async () => {
    const { result } = renderHook(() => useFilteredEntities())
    const firstResult = result.current

    // Change a related state property
    act(() => {
      useStudioStore.getState().setSearchQuery('test')
    })

    // The ranked pass reads the query through useDeferredValue, so the new
    // list arrives a render later instead of inside the keystroke render.
    await waitFor(() => {
      expect(result.current).not.toBe(firstResult)
    })
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

  it('converges the ranked list to the final query', async () => {
    useStudioStore.setState({
      entities: [ALPHA_ENTITY, BETA_ENTITY],
      claims: [],
      searchQuery: '',
      typeFilter: 'all',
      sortBy: 'updated',
      sortDir: 'desc',
    })
    const { result } = renderHook(() => useFilteredEntities())
    expect(result.current.map((entity) => entity.id)).toEqual(['alpha-1', 'beta-1'])

    act(() => {
      useStudioStore.getState().setSearchQuery('alpha')
    })

    // The BM25 pass is deferred: the list converges to the query instead of
    // being ranked synchronously inside the keystroke render.
    await waitFor(() => {
      expect(result.current.map((entity) => entity.id)).toEqual(['alpha-1'])
    })
  })

  it('returns the unfiltered list for an empty or whitespace-only query', async () => {
    useStudioStore.setState({
      entities: [ALPHA_ENTITY, BETA_ENTITY],
      claims: [],
      searchQuery: '   ',
      typeFilter: 'all',
      sortBy: 'updated',
      sortDir: 'desc',
    })
    const { result } = renderHook(() => useFilteredEntities())

    // Whitespace is not a query: the whole corpus comes back, sorted.
    expect(result.current.map((entity) => entity.id)).toEqual(['alpha-1', 'beta-1'])

    act(() => {
      useStudioStore.getState().setSearchQuery('alpha')
    })
    await waitFor(() => {
      expect(result.current.map((entity) => entity.id)).toEqual(['alpha-1'])
    })

    // Clearing the query converges back to the unfiltered corpus.
    act(() => {
      useStudioStore.getState().setSearchQuery('')
    })
    await waitFor(() => {
      expect(result.current.map((entity) => entity.id)).toEqual(['alpha-1', 'beta-1'])
    })
  })
})
