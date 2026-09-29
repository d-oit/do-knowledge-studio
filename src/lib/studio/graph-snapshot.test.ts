import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  GRAPH_SNAPSHOT_KEY,
  buildGraphSnapshot,
  clearGraphSnapshot,
  readGraphSnapshot,
  saveGraphSnapshot,
  type GraphSnapshot,
} from './graph-snapshot'

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
