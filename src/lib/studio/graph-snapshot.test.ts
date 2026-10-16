import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  GRAPH_SNAPSHOT_KEY,
  buildGraphSnapshot,
  clearGraphSnapshot,
  readGraphSnapshot,
  saveGraphSnapshot,
  diffGraphSnapshot,
  type GraphSnapshot,
} from './graph-snapshot'
import type { Entity } from './types'

const validSnapshot = (): GraphSnapshot =>
  buildGraphSnapshot(
    { layout: 'circular', selectedEntityId: 'e1', focusMode: true },
    { panX: 10, panY: -20, zoom: 1.5 },
  )

describe('graph snapshot persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  /**
   * Runs `body` with `localStorage` replaced by a stub whose `method` throws.
   * The jsdom instance resolves `localStorage` through the global, so stubbing
   * the global is what the module under test actually reads. The stub is
   * confined to `body` so it cannot leak into the next test.
   */
  const withThrowingStorage = <T,>(
    method: 'getItem' | 'setItem' | 'removeItem',
    body: () => T,
  ): T => {
    const real = window.localStorage
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      [method]: () => {
        throw new Error('SecurityError')
      },
    })
    try {
      return body()
    } finally {
      vi.stubGlobal('localStorage', real)
    }
  }

  it('round-trips a snapshot through storage', () => {
    const snapshot = validSnapshot()
    expect(saveGraphSnapshot(snapshot)).toBe(true)

    const restored = readGraphSnapshot()
    expect(restored).toMatchObject({
      layout: 'circular',
      selectedEntityId: 'e1',
      focusMode: true,
      panX: 10,
      panY: -20,
      zoom: 1.5,
    })
  })

  it('writes under the documented storage key', () => {
    saveGraphSnapshot(validSnapshot())
    expect(localStorage.getItem(GRAPH_SNAPSHOT_KEY)).not.toBeNull()
  })

  it('stamps the snapshot with an ISO timestamp', () => {
    const { timestamp } = buildGraphSnapshot(
      { layout: 'force', selectedEntityId: null, focusMode: false },
      { panX: 0, panY: 0, zoom: 1 },
    )
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(Number.isNaN(Date.parse(timestamp))).toBe(false)
  })

  it('returns null when nothing is stored', () => {
    expect(readGraphSnapshot()).toBeNull()
  })

  it('returns null and clears an unparseable entry', () => {
    localStorage.setItem(GRAPH_SNAPSHOT_KEY, 'not json')
    expect(readGraphSnapshot()).toBeNull()
    // Dropping it keeps a corrupt entry from wedging every future read.
    expect(localStorage.getItem(GRAPH_SNAPSHOT_KEY)).toBeNull()
  })

  it('rejects an unknown layout without throwing', () => {
    localStorage.setItem(
      GRAPH_SNAPSHOT_KEY,
      JSON.stringify({ ...validSnapshot(), layout: 'telepathic' }),
    )
    expect(readGraphSnapshot()).toBeNull()
    expect(localStorage.getItem(GRAPH_SNAPSHOT_KEY)).toBeNull()
  })

  it('rejects a zoom outside the range the canvas can render', () => {
    // A string was supplied before, which only proved the type check fires;
    // these are the values that actually reach a corrupt localStorage.
    for (const zoom of ['big', Number.POSITIVE_INFINITY, 0, -1, 99]) {
      localStorage.setItem(
        GRAPH_SNAPSHOT_KEY,
        JSON.stringify({ ...validSnapshot(), zoom }),
      )
      expect(readGraphSnapshot()).toBeNull()
    }
  })

  it('accepts a zoom at the boundary of the supported range', () => {
    for (const zoom of [0.3, 3]) {
      localStorage.setItem(
        GRAPH_SNAPSHOT_KEY,
        JSON.stringify({ ...validSnapshot(), zoom }),
      )
      expect(readGraphSnapshot()?.zoom).toBe(zoom)
    }
  })

  it('rejects a zero zoom, which would collapse the viewBox', () => {
    localStorage.setItem(GRAPH_SNAPSHOT_KEY, JSON.stringify({ ...validSnapshot(), zoom: 0 }))
    expect(readGraphSnapshot()).toBeNull()
  })

  it('accepts an explicitly null selection', () => {
    saveGraphSnapshot(
      buildGraphSnapshot(
        { layout: 'force', selectedEntityId: null, focusMode: false },
        { panX: 0, panY: 0, zoom: 1 },
      ),
    )
    expect(readGraphSnapshot()?.selectedEntityId).toBeNull()
  })

  it('clears a stored snapshot', () => {
    saveGraphSnapshot(validSnapshot())
    clearGraphSnapshot()
    expect(readGraphSnapshot()).toBeNull()
  })

  it('reports a failed write instead of throwing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    withThrowingStorage('setItem', () => {
      expect(saveGraphSnapshot(validSnapshot())).toBe(false)
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to save graph snapshot:',
      'SecurityError',
    )
  })

  it('reports an unreadable store instead of throwing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    withThrowingStorage('getItem', () => {
      expect(readGraphSnapshot()).toBeNull()
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to read graph snapshot:',
      'SecurityError',
    )
  })

  it('reports a failed clear instead of throwing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    withThrowingStorage('removeItem', () => {
      expect(() => { clearGraphSnapshot() }).not.toThrow()
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to clear graph snapshot:',
      'SecurityError',
    )
  })
})

describe('diffGraphSnapshot', () => {
  const makeEntity = (id: string, name: string, targetIds: string[] = []): Entity => ({
    id,
    name,
    type: 'note',
    description: '',
    content: '',
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    links: targetIds.map((targetId) => ({ targetId, relation: 'relates_to' })),
  })

  it('computes added and removed entities and edges when topology is present', () => {
    const e1 = makeEntity('e1', 'Alpha', ['e2'])
    const e2 = makeEntity('e2', 'Beta')
    const e3 = makeEntity('e3', 'Gamma')

    const snapshot = buildGraphSnapshot(
      { layout: 'force', selectedEntityId: null, focusMode: false },
      { panX: 0, panY: 0, zoom: 1 },
      [e1, e2],
    )

    // Live state has e2 and e3, e1 was removed, e3 was added
    const liveEntities = [e2, e3]
    const diff = diffGraphSnapshot(snapshot, {
      layout: 'circular',
      focusMode: false,
      selectedEntityId: null,
      zoom: 1.5,
      panOffset: { x: 50, y: 50 },
      entities: liveEntities,
    })

    expect(diff.layoutChanged).toBe(true)
    expect(diff.previousLayout).toBe('force')
    expect(diff.currentLayout).toBe('circular')
    expect(diff.viewportChanged).toBe(true)
    expect(diff.zoomDelta).toBeCloseTo(0.5)
    expect(diff.panDelta).toEqual({ x: 50, y: 50 })

    expect(diff.hasTopologyData).toBe(true)
    expect(diff.addedEntities).toEqual([{ id: 'e3', name: 'Gamma' }])
    expect(diff.removedEntities).toEqual([{ id: 'e1', name: 'Alpha' }])
    expect(diff.retainedEntityCount).toBe(1) // e2
    expect(diff.removedEdges).toEqual([
      { from: 'e1', to: 'e2', fromName: 'Alpha', toName: 'Beta' },
    ])
    expect(diff.addedEdges).toEqual([])
  })

  it('distinguishes endpoint pairs whose hyphenated ids would collide in a joined key', () => {
    // `a-b -> c` and `a -> b-c` both concatenate to `a-b-c` under the
    // historical `${from}-${to}` scheme; they must not count as retained.
    const snapshot = buildGraphSnapshot(
      { layout: 'force', selectedEntityId: null, focusMode: false },
      { panX: 0, panY: 0, zoom: 1 },
      [makeEntity('a-b', 'Alpha Beta', ['c']), makeEntity('c', 'Gamma')],
    )

    const diff = diffGraphSnapshot(snapshot, {
      layout: 'force',
      focusMode: false,
      selectedEntityId: null,
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      entities: [makeEntity('a', 'Alpha', ['b-c']), makeEntity('b-c', 'Beta Gamma')],
    })

    expect(diff.retainedEdgeCount).toBe(0)
    expect(diff.addedEdges).toEqual([
      { from: 'a', to: 'b-c', fromName: 'Alpha', toName: 'Beta Gamma' },
    ])
    expect(diff.removedEdges).toEqual([
      { from: 'a-b', to: 'c', fromName: 'Alpha Beta', toName: 'Gamma' },
    ])
  })

  it('reports focus mode and selection changes with display names', () => {
    const e1 = makeEntity('e1', 'Alpha')
    const e2 = makeEntity('e2', 'Beta')

    const snapshot = buildGraphSnapshot(
      { layout: 'force', selectedEntityId: 'e1', focusMode: false },
      { panX: 0, panY: 0, zoom: 1 },
      [e1, e2],
    )

    const diff = diffGraphSnapshot(snapshot, {
      layout: 'force',
      focusMode: true,
      selectedEntityId: 'e2',
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      entities: [e1, e2],
    })

    expect(diff.focusModeChanged).toBe(true)
    expect(diff.previousFocusMode).toBe(false)
    expect(diff.currentFocusMode).toBe(true)
    expect(diff.selectionChanged).toBe(true)
    expect(diff.previousSelection).toEqual({ id: 'e1', name: 'Alpha' })
    expect(diff.currentSelection).toEqual({ id: 'e2', name: 'Beta' })
    expect(diff.viewportChanged).toBe(false)
  })

  it('handles backwards-compatible v1 snapshots without topology data gracefully', () => {
    const v1Snapshot: GraphSnapshot = {
      layout: 'force',
      selectedEntityId: 'e1',
      focusMode: false,
      panX: 10,
      panY: 20,
      zoom: 1.0,
      timestamp: '2026-10-15T00:00:00Z',
    }

    const diff = diffGraphSnapshot(v1Snapshot, {
      layout: 'force',
      focusMode: false,
      selectedEntityId: 'e1',
      zoom: 1.0,
      panOffset: { x: 10, y: 20 },
      entities: [makeEntity('e1', 'Alpha')],
    })

    expect(diff.layoutChanged).toBe(false)
    expect(diff.focusModeChanged).toBe(false)
    expect(diff.selectionChanged).toBe(false)
    expect(diff.viewportChanged).toBe(false)
    expect(diff.hasTopologyData).toBe(false)
    expect(diff.addedEntities).toEqual([])
    expect(diff.removedEntities).toEqual([])
  })
})
