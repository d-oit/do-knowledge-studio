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
    viewportChanged: true,
    zoomDelta: 0.5,
    panDelta: { x: 30, y: -20 },
    hasTopologyData: true,
    addedEntities: ['New Node Alpha', 'New Node Beta'],
    removedEntities: ['old-entity-1'],
    retainedEntityCount: 5,
    addedEdges: ['e1-e2'],
    removedEdges: ['e3-e4'],
    retainedEdgeCount: 4,
  }

  it('renders nothing when diff is null', () => {
    const { container } = render(
      <GraphComparisonDialog open={true} onClose={vi.fn()} diff={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders diff details, layout changes, and topology counts', () => {
    render(
      <GraphComparisonDialog open={true} onClose={vi.fn()} diff={baseDiff} />,
    )

    expect(screen.getByRole('heading', { name: /Graph Revision Comparison/i })).toBeDefined()
    expect(screen.getByText(/force → circular/)).toBeDefined()
    expect(screen.getByText(/New Node Alpha/)).toBeDefined()
    expect(screen.getByText(/New Node Beta/)).toBeDefined()
    expect(screen.getByText(/1 entities from snapshot are no longer in graph/)).toBeDefined()
    expect(screen.getByText(/5 retained entities/)).toBeDefined()
  })

  it('calls onClose when close button or modal action is clicked', () => {
    const onClose = vi.fn()
    render(
      <GraphComparisonDialog open={true} onClose={onClose} diff={baseDiff} />,
    )

    const closeBtn = screen.getByRole('button', { name: /Close comparison dialog/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
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
