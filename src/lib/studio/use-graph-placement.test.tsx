import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { seedGraph } from './seed-data'
import type { Entity } from './types'
import { SYNC_PLACEMENT_NODE_LIMIT, useGraphPlacement } from './use-graph-placement'

const makeEntity = (id: string): Entity => ({
  id,
  name: `Entity ${id}`,
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  links: [],
})

/** A fresh entity array on every call, as a filtered copy or selector would build. */
const corpus = (total: number): Entity[] =>
  Array.from({ length: total }, (_, index) => makeEntity(`node-${index}`))

describe('useGraphPlacement', () => {
  it('places a small corpus synchronously', () => {
    const entities = corpus(5)
    const { result } = renderHook(() => useGraphPlacement(entities, seedGraph.nodes, null))
    expect(result.current.map((node) => node.id).sort()).toEqual(
      entities.map((entity) => entity.id).sort(),
    )
  })

  it('does not re-place when a caller rebuilds an identical entity array', () => {
    // Regression: placement keyed on array identity re-ran its effect on every
    // commit for such a caller, setting state forever.
    const entities = corpus(4)
    const { result, rerender } = renderHook(() =>
      // New array, same content on every render.
      useGraphPlacement([...entities], seedGraph.nodes, null),
    )

    act(() => {
      rerender()
      rerender()
    })

    expect(result.current).toHaveLength(entities.length)
  })

  it('starts above the sync limit and fills in across frames', async () => {
    const entities = corpus(SYNC_PLACEMENT_NODE_LIMIT + 20)
    const { result } = renderHook(() => useGraphPlacement(entities, seedGraph.nodes, null))

    await waitFor(() => {
      expect(result.current).toHaveLength(entities.length)
    })
  })
})
