import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStudioStore, useFilteredEntities, useStats } from './store'
import { makeClaim, makeEntity } from './test-helpers'
import { installStoreCoverageHooks } from './store-coverage-support'

installStoreCoverageHooks()

describe('Studio Store branch coverage', () => {
  describe('useFilteredEntities', () => {
    const e1 = makeEntity({
      id: 'e-1',
      name: 'Solar Panel',
      type: 'concept',
      description: 'energy technology',
      tags: ['green'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const e2 = makeEntity({
      id: 'e-2',
      name: 'Nuclear Reactor',
      type: 'reference',
      description: 'fission power',
      tags: ['power'],
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    })

    it('filters by type', () => {
      useStudioStore.setState({ entities: [e1, e2], typeFilter: 'all' })
      const { result } = renderHook(() => useFilteredEntities())
      expect(result.current).toHaveLength(2)
      act(() => {
        useStudioStore.getState().setTypeFilter('concept')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1'])
    })

    it('filters by search query across name, description, and tags', () => {
      useStudioStore.setState({ entities: [e1, e2], typeFilter: 'all', searchQuery: '' })
      const { result } = renderHook(() => useFilteredEntities())
      act(() => {
        useStudioStore.getState().setSearchQuery('solar')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1'])
      act(() => {
        useStudioStore.getState().setSearchQuery('power')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-2'])
      act(() => {
        useStudioStore.getState().setSearchQuery('   energy   ')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1'])
      act(() => {
        useStudioStore.getState().setSearchQuery('zzz')
      })
      expect(result.current).toHaveLength(0)
    })

    it('sorts by name, created, and updated in both directions', () => {
      useStudioStore.setState({
        entities: [e1, e2],
        typeFilter: 'all',
        searchQuery: '',
        sortBy: 'updated',
        sortDir: 'desc',
      })
      const { result } = renderHook(() => useFilteredEntities())
      expect(result.current.map((e) => e.id)).toEqual(['e-2', 'e-1'])
      act(() => {
        useStudioStore.getState().setSortDir('asc')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1', 'e-2'])
      act(() => {
        useStudioStore.getState().setSortBy('name')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-2', 'e-1'])
      act(() => {
        useStudioStore.getState().setSortBy('created')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-1', 'e-2'])
    })

    it('matches entities via attached claim statements in BM25 retrieval', () => {
      const e3 = makeEntity({
        id: 'e-3',
        name: 'Project Alpha',
        description: 'internal research project',
        tags: ['project'],
      })
      const claim = makeClaim({
        id: 'c-3',
        entityId: 'e-3',
        statement: 'photovoltaic energy efficiency reached 25%',
      })
      useStudioStore.setState({
        entities: [e1, e2, e3],
        claims: [claim],
        typeFilter: 'all',
        searchQuery: '',
      })
      const { result } = renderHook(() => useFilteredEntities())
      act(() => {
        useStudioStore.getState().setSearchQuery('photovoltaic')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-3'])
    })

    it('preserves BM25 relevance score order and supports sortDir reversal when search query is set', () => {
      const eA = makeEntity({
        id: 'e-a',
        name: 'Topic Alpha',
        description: 'quantum computing quantum algorithms',
      })
      const eB = makeEntity({
        id: 'e-b',
        name: 'Topic Beta',
        description: 'quantum physics intro',
      })
      useStudioStore.setState({
        entities: [eA, eB],
        claims: [],
        typeFilter: 'all',
        searchQuery: 'quantum',
        sortDir: 'desc',
      })
      const { result } = renderHook(() => useFilteredEntities())
      // eA has higher term frequency for 'quantum', so it ranks first in BM25 relevance
      expect(result.current.map((e) => e.id)).toEqual(['e-a', 'e-b'])

      act(() => {
        useStudioStore.getState().setSortDir('asc')
      })
      expect(result.current.map((e) => e.id)).toEqual(['e-b', 'e-a'])
    })
  })

  describe('useStats', () => {
    it('computes totals, verified count, type breakdown, and recent entities', () => {
      const e1 = makeEntity({
        id: 'e-1',
        type: 'concept',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
      const e2 = makeEntity({
        id: 'e-2',
        type: 'concept',
        updatedAt: '2026-01-02T00:00:00.000Z',
      })
      const e3 = makeEntity({
        id: 'e-3',
        type: 'reference',
        updatedAt: '2026-01-03T00:00:00.000Z',
      })
      useStudioStore.setState({
        entities: [e1, e2, e3],
        claims: [
          makeClaim({ id: 'c-1', verification: 'verified' }),
          makeClaim({ id: 'c-2', verification: 'unverified' }),
          makeClaim({ id: 'c-3', verification: 'verified' }),
        ],
      })
      const { result } = renderHook(() => useStats())
      expect(result.current.total).toBe(3)
      expect(result.current.claims).toBe(3)
      expect(result.current.verified).toBe(2)
      expect(result.current.byType).toEqual({ concept: 2, reference: 1 })
      expect(result.current.recent.map((e) => e.id)).toEqual(['e-3', 'e-2', 'e-1'])
    })
  })
})
