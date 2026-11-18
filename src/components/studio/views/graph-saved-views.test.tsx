import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EMPTY_GRAPH_FILTER } from '@/lib/studio/graph-query'
import type { SavedGraphView, SavedGraphViewInput } from '@/lib/studio/graph-views'
import { GraphSavedViews } from './graph-saved-views'

const makeInput = (query: SavedGraphViewInput['query'] = null): SavedGraphViewInput => ({
  name: '',
  filter: EMPTY_GRAPH_FILTER,
  layout: 'force',
  focusMode: false,
  viewport: { panX: 0, panY: 0, zoom: 1 },
  query,
})

const makeView = (id: string, name: string): SavedGraphView => ({
  id,
  name,
  filter: EMPTY_GRAPH_FILTER,
  layout: 'force',
  focusMode: false,
  viewport: { panX: 0, panY: 0, zoom: 1 },
  query: null,
  createdAt: '2026-11-05T00:00:00.000Z',
})

describe('GraphSavedViews', () => {
  it('lists saved views and reports an empty list', () => {
    render(
      <GraphSavedViews
        views={[]}
        currentView={makeInput()}
        onSaveView={vi.fn()}
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
      />,
    )
    expect(screen.getByText('No saved views yet.')).toBeDefined()
  })

  it('saves a named view with the current filter and query', () => {
    const onSaveView = vi.fn()
    render(
      <GraphSavedViews
        views={[]}
        currentView={makeInput({ op: 'and', exclude: false, children: [] })}
        onSaveView={onSaveView}
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
      />,
    )
    const save = screen.getByRole('button', { name: 'Save view' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'My view' } })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    expect(onSaveView).toHaveBeenCalledTimes(1)
    const saved = onSaveView.mock.calls[0]?.[0] as SavedGraphView
    expect(saved.name).toBe('My view')
    expect(saved.query).toEqual({ op: 'and', exclude: false, children: [] })
  })

  it('blocks saving while the active query is invalid', () => {
    const onSaveView = vi.fn()
    const invalidQuery: SavedGraphViewInput['query'] = {
      op: 'and',
      exclude: false,
      children: [{ op: 'and', exclude: false, children: [] }],
    }
    render(
      <GraphSavedViews
        views={[]}
        currentView={makeInput(invalidQuery)}
        onSaveView={onSaveView}
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'Bad' } })
    expect(screen.getByRole('button', { name: 'Save view' })).toBeDisabled()
    expect(
      screen.getByText('This query has issues and is not applied to the canvas.'),
    ).toBeDefined()
    expect(onSaveView).not.toHaveBeenCalled()
  })

  it('renames a view preserving its id and createdAt', () => {
    const view = makeView('v1', 'Old name')
    const onSaveView = vi.fn()
    render(
      <GraphSavedViews
        views={[view]}
        currentView={makeInput()}
        onSaveView={onSaveView}
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Rename saved view Old name' }))
    const input = screen.getByLabelText('Rename saved view Old name')
    fireEvent.change(input, { target: { value: 'New name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(onSaveView).toHaveBeenCalledTimes(1)
    const renamed = onSaveView.mock.calls[0]?.[0] as SavedGraphView
    expect(renamed.id).toBe('v1')
    expect(renamed.name).toBe('New name')
    expect(renamed.createdAt).toBe(view.createdAt)
  })

  it('duplicates a view under a copy name with a fresh id', () => {
    const view = makeView('v1', 'Original')
    const onSaveView = vi.fn()
    render(
      <GraphSavedViews
        views={[view]}
        currentView={makeInput()}
        onSaveView={onSaveView}
        onApplyView={vi.fn()}
        onDeleteView={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate saved view Original' }))
    expect(onSaveView).toHaveBeenCalledTimes(1)
    const copy = onSaveView.mock.calls[0]?.[0] as SavedGraphView
    expect(copy.name).toBe('Copy of Original')
    expect(copy.id).not.toBe('v1')
  })

  it('deletes a view by id', () => {
    const onDeleteView = vi.fn()
    render(
      <GraphSavedViews
        views={[makeView('v1', 'Original')]}
        currentView={makeInput()}
        onSaveView={vi.fn()}
        onApplyView={vi.fn()}
        onDeleteView={onDeleteView}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete saved view Original' }))
    expect(onDeleteView).toHaveBeenCalledWith('v1')
  })
})
