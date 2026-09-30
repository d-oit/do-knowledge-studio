import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { GraphEdge, GraphNode } from '@/lib/studio/types'
import { FOCUS_MODE_FILTER_STYLE, GraphEdgeElement } from './graph-elements'

const sourceNode: GraphNode = { id: 'a', label: 'Alpha', type: 'note', x: 0, y: 0 }
const targetNode: GraphNode = { id: 'b', label: 'Beta', type: 'note', x: 100, y: 40 }
const edge: GraphEdge = { id: 'a-b', source: 'a', target: 'b', relation: 'relates to' }

/** Renders the edge inside an `<svg>` so jsdom applies SVG semantics. */
const renderEdge = (selectedEntityId: string | null) =>
  render(
    <svg>
      <GraphEdgeElement
        edge={edge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        selectedEntityId={selectedEntityId}
      />
    </svg>,
  )

describe('GraphEdgeElement', () => {
  it('draws the edge as a line between the two node positions', () => {
    const { container } = renderEdge(null)

    const line = container.querySelector('line')
    expect(line).not.toBeNull()
    expect(line?.getAttribute('x1')).toBe('0')
    expect(line?.getAttribute('y1')).toBe('0')
    expect(line?.getAttribute('x2')).toBe('100')
    expect(line?.getAttribute('y2')).toBe('40')
  })

  it('shows the relation label only while the edge touches the selection', () => {
    const selected = renderEdge('b')
    expect(selected.container.querySelector('text')?.textContent).toBe('relates to')
    selected.unmount()

    const unselected = renderEdge(null)
    expect(unselected.container.querySelector('text')).toBeNull()
  })

  it('highlights the side the selection is on', () => {
    // The rule is "either endpoint", so a selection on either end must match.
    expect(renderEdge('a').container.querySelector('text')).not.toBeNull()
    expect(renderEdge('b').container.querySelector('text')).not.toBeNull()
    expect(renderEdge('unrelated').container.querySelector('text')).toBeNull()
  })

  it('offsets the label perpendicular to the line so it never sits on it', () => {
    const { container } = renderEdge('a')

    const text = container.querySelector('text')
    const x = Number(text?.getAttribute('x'))
    const y = Number(text?.getAttribute('y'))
    // A label at the exact midpoint would be unreadable under the stroke.
    expect(x).not.toBe((sourceNode.x + targetNode.x) / 2)
    expect(y).not.toBe((sourceNode.y + targetNode.y) / 2)
    // The perpendicular offset is exactly |OFFSET| away from the midpoint.
    const midpointDistance = Math.hypot(
      x - (sourceNode.x + targetNode.x) / 2,
      y - (sourceNode.y + targetNode.y) / 2,
    )
    expect(midpointDistance).toBeCloseTo(14, 5)
  })

  it('keeps the focus-mode filter as a drop-shadow', () => {
    // Guards the visual affordance that marks the focused graph node.
    expect(String(FOCUS_MODE_FILTER_STYLE.filter)).toContain('drop-shadow')
  })
})
