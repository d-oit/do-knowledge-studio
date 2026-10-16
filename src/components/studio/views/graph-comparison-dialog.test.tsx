import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GraphComparisonDialog } from './graph-comparison-dialog'
import type { GraphSnapshotDiff } from '@/lib/studio/graph-snapshot'

describe('GraphComparisonDialog', () => {
  const baseDiff: GraphSnapshotDiff = {
    snapshotTimestamp: '2026-10-15T12:00:00.000Z',
    layoutChanged: true,
    previousLayout: 'force',
    currentLayout: 'circular',
    focusModeChanged: true,
    previousFocusMode: false,
    currentFocusMode: true,
    selectionChanged: true,
    previousSelection: { id: 'old-entity-1', name: 'Retired Note' },
    currentSelection: { id: 'e1', name: 'Alpha' },
    viewportChanged: true,
    zoomDelta: 0.5,
    panDelta: { x: 30, y: -20 },
    hasTopologyData: true,
    addedEntities: [
      { id: 'e3', name: 'New Node Alpha' },
      { id: 'e4', name: 'New Node Beta' },
    ],
    removedEntities: [{ id: 'old-entity-1', name: 'Retired Note' }],
    retainedEntityCount: 5,
    addedEdges: [{ from: 'e3', to: 'e4', fromName: 'New Node Alpha', toName: 'New Node Beta' }],
    removedEdges: [{ from: 'e1', to: 'e2', fromName: 'Alpha', toName: 'Beta' }],
    retainedEdgeCount: 4,
  }

  it('renders nothing when diff is null', () => {
    const { container } = render(
      <GraphComparisonDialog open={true} onClose={vi.fn()} diff={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders itemized entity, connection, and canvas change details', () => {
    render(
      <GraphComparisonDialog open={true} onClose={vi.fn()} diff={baseDiff} />,
    )

    expect(screen.getByRole('heading', { name: /Graph Revision Comparison/i })).toBeDefined()
    expect(screen.getByText(/force → circular/)).toBeDefined()
    // Viewport deltas include pan, not just zoom.
    expect(screen.getByText(/Δx \+30\.00, Δy -20\.00/)).toBeDefined()
    expect(screen.getByText(/off → on/)).toBeDefined()
    expect(screen.getByText(/Retired Note → Alpha/)).toBeDefined()
    // Itemized entity and connection lists, not just counts.
    expect(screen.getByText('New Node Alpha')).toBeDefined()
    expect(screen.getByText('New Node Beta')).toBeDefined()
    expect(screen.getByText(/Removed Entities \(1\)/)).toBeDefined()
    expect(screen.getByText(/Added Connections \(1\)/)).toBeDefined()
    expect(screen.getByText(/Removed Connections \(1\)/)).toBeDefined()
    expect(screen.getByText('5 retained entities')).toBeDefined()
  })

  it('calls onClose when the header close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <GraphComparisonDialog open={true} onClose={onClose} diff={baseDiff} />,
    )

    const closeBtn = screen.getByRole('button', { name: /Close comparison dialog/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the footer Close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <GraphComparisonDialog open={true} onClose={onClose} diff={baseDiff} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders an unchanged summary when topology matches the snapshot', () => {
    const unchangedDiff: GraphSnapshotDiff = {
      ...baseDiff,
      layoutChanged: false,
      focusModeChanged: false,
      selectionChanged: false,
      viewportChanged: false,
      zoomDelta: 0,
      panDelta: { x: 0, y: 0 },
      addedEntities: [],
      removedEntities: [],
      addedEdges: [],
      removedEdges: [],
    }

    render(
      <GraphComparisonDialog open={true} onClose={vi.fn()} diff={unchangedDiff} />,
    )

    expect(
      screen.getByText(/Graph entities and connections are identical to snapshot/),
    ).toBeDefined()
    // Zoom and pan rows both report a plain unchanged value, not `+0.00`.
    expect(screen.getAllByText('Unchanged').length).toBe(2)
  })

  it('renders an unparseable snapshot timestamp without crashing', () => {
    const invalidTimestampDiff: GraphSnapshotDiff = {
      ...baseDiff,
      snapshotTimestamp: 'not-a-date',
    }

    // localStorage is user-writable; a junk timestamp must degrade to the raw
    // value rather than throwing RangeError from Intl.DateTimeFormat.
    render(
      <GraphComparisonDialog open={true} onClose={vi.fn()} diff={invalidTimestampDiff} />,
    )

    expect(screen.getByText(/not-a-date/)).toBeDefined()
  })

  it('handles snapshot diff without topology data gracefully', () => {
    const noTopologyDiff: GraphSnapshotDiff = {
      ...baseDiff,
      hasTopologyData: false,
      addedEntities: [],
      removedEntities: [],
      addedEdges: [],
      removedEdges: [],
    }

    render(
      <GraphComparisonDialog open={true} onClose={vi.fn()} diff={noTopologyDiff} />,
    )

    expect(
      screen.getByText(/Saved snapshot predates topology tracking/),
    ).toBeDefined()
  })
})
