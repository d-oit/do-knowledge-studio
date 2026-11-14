import { describe, it, expect } from 'vitest'
import type { GraphNode } from './types'
import { findDirectionalNodeId, NAV_KEY_DIRECTIONS } from './graph-keyboard-nav'

const makeNode = (id: string, x: number, y: number): GraphNode => ({
  id,
  label: id,
  type: 'note',
  x,
  y,
})

const center = makeNode('center', 0, 0)
const up = makeNode('up', 0, -100)
const down = makeNode('down', 0, 100)
const left = makeNode('left', -100, 0)
const right = makeNode('right', 100, 0)

const grid = [center, up, down, left, right]

describe('findDirectionalNodeId', () => {
  it('moves to the nearest node in each direction', () => {
    expect(findDirectionalNodeId(grid, 'center', 'up')).toBe('up')
    expect(findDirectionalNodeId(grid, 'center', 'down')).toBe('down')
    expect(findDirectionalNodeId(grid, 'center', 'left')).toBe('left')
    expect(findDirectionalNodeId(grid, 'center', 'right')).toBe('right')
  })

  it('returns null when nothing lies further in that direction', () => {
    expect(findDirectionalNodeId(grid, 'up', 'up')).toBeNull()
    expect(findDirectionalNodeId(grid, 'right', 'right')).toBeNull()
  })

  it('ignores the perpendicular neighbours, so arrows do not zig-zag', () => {
    // From `left`, moving right must pass through the centre, not skip to `right`.
    expect(findDirectionalNodeId(grid, 'left', 'right')).toBe('center')
  })

  it('prefers a node directly ahead over a closer sideways one', () => {
    const nodes = [
      makeNode('here', 0, 0),
      makeNode('ahead', 60, 0),
      makeNode('diagonal', 40, 40),
    ]
    expect(findDirectionalNodeId(nodes, 'here', 'right')).toBe('ahead')
  })

  it('breaks ties deterministically by id', () => {
    const nodes = [makeNode('start', 0, 0), makeNode('b', 50, 0), makeNode('a', 50, 0)]
    expect(findDirectionalNodeId(nodes, 'start', 'right')).toBe('a')
  })

  it('returns null for an unknown current node', () => {
    expect(findDirectionalNodeId(grid, 'missing', 'up')).toBeNull()
  })
})

describe('NAV_KEY_DIRECTIONS', () => {
  it('maps the four arrow keys and nothing else', () => {
    expect(NAV_KEY_DIRECTIONS).toEqual({
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    })
  })
})
