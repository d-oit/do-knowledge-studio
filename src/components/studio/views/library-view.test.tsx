import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import {
  libraryViewState,
  mockEntities,
  mockSetShowAll,
  mockSetViewMode,
  mockStartEdit,
  mockStartNew,
  resetLibraryViewMocks,
} from './library-view.test-helpers'
import { LibraryView } from './library-view'

describe('LibraryView', () => {
  beforeEach(resetLibraryViewMocks)

  it('renders empty state when no entities', () => {
    libraryViewState.currentEntities = []
    libraryViewState.filteredEntities = []
    render(<LibraryView />)
    expect(screen.getByText('No entities yet')).toBeDefined()
    expect(screen.getByText(/Create your first entity/)).toBeDefined()
  })

  it('renders entity cards in grid view', () => {
    render(<LibraryView />)
    expect(screen.getByText('Alpha Concept')).toBeDefined()
    expect(screen.getByText('Beta Note')).toBeDefined()
    expect(screen.getByText('First concept')).toBeDefined()
    expect(screen.getByText('A note')).toBeDefined()
  })

  it('type filter buttons exist with correct labels', () => {
    render(<LibraryView />)
    expect(screen.getByText('All')).toBeDefined()
    expect(screen.getByText('Notes')).toBeDefined()
    expect(screen.getByText('Concepts')).toBeDefined()
    expect(screen.getByText('People')).toBeDefined()
    expect(screen.getByText('Projects')).toBeDefined()
  })

  it('sort controls exist', () => {
    render(<LibraryView />)
    expect(screen.getByLabelText('Sort by')).toBeDefined()
    expect(screen.getByLabelText(/Sort (ascending|descending)/)).toBeDefined()
  })

  it('new button exists', () => {
    render(<LibraryView />)
    expect(screen.getByText('New')).toBeDefined()
  })

  it('clicking entity card calls startEdit', () => {
    render(<LibraryView />)
    const card = screen.getByText('Alpha Concept')
    card.closest('button')?.click()
    expect(mockStartEdit).toHaveBeenCalledWith('ent-1')
  })

  it('no-matches state shows when filters exclude all', () => {
    libraryViewState.filteredEntities = []
    render(<LibraryView />)
    expect(screen.getByText('No matches found')).toBeDefined()
    expect(screen.getByText(/Try adjusting your search terms or filters/)).toBeDefined()
  })

  it('displays showing count', () => {
    render(<LibraryView />)
    expect(screen.getAllByText(/Showing 2 entit(y|ies)/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows singular entity count', () => {
    libraryViewState.filteredEntities = [mockEntities[0]]
    render(<LibraryView />)
    expect(screen.getAllByText(/Showing 1 entity/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders list view and opens entities from row buttons (#861)', () => {
    const { rerender } = render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: 'List view' }))
    expect(mockSetViewMode).toHaveBeenCalledWith('list')

    libraryViewState.currentViewMode = 'list'
    rerender(<LibraryView />)

    const table = within(screen.getByRole('table'))
    expect(table.queryByRole('link')).toBeNull()
    const openButtons = table.getAllByRole('button', { name: /Open / })
    expect(openButtons).toHaveLength(2)

    // jsdom does not synthesize keyboard activation; native buttons in tab order provide it.
    for (const button of openButtons) {
      expect(button.tagName).toBe('BUTTON')
      expect(button.getAttribute('type')).toBe('button')
      expect(Number(button.getAttribute('tabindex') ?? 0)).toBeGreaterThanOrEqual(0)
    }

    fireEvent.click(openButtons[1])
    expect(mockStartEdit).toHaveBeenCalledTimes(1)
    expect(mockStartEdit).toHaveBeenCalledWith('ent-2')
  })

  it('renders tag overflow in grid view', () => {
    libraryViewState.currentEntities = [{ ...mockEntities[0], tags: ['one', 'two', 'three'] }]
    libraryViewState.filteredEntities = libraryViewState.currentEntities
    render(<LibraryView />)
    expect(screen.getByText('+1')).toBeDefined()
  })

  it('keeps a stable container width regardless of right-panel state (#868)', () => {
    const { container, rerender } = render(<LibraryView />)
    expect(container.firstElementChild).toHaveClass('max-w-5xl')

    libraryViewState.currentRightPanelOpen = true
    rerender(<LibraryView />)
    expect(container.firstElementChild).toHaveClass('max-w-5xl')
  })

  it('starts a new entity from both New actions', () => {
    const { unmount } = render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /^New$/ }))
    expect(mockStartNew).toHaveBeenCalledTimes(1)
    unmount()

    libraryViewState.currentEntities = []
    libraryViewState.filteredEntities = []
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /Create your first entity/ }))
    expect(mockStartNew).toHaveBeenCalledTimes(2)
  })

  it('caps large lists at the initial limit and expands with Show all', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...mockEntities[0],
      id: `ent-${i}`,
      name: `Entity ${i}`,
    }))
    libraryViewState.currentEntities = many
    libraryViewState.filteredEntities = many
    const { rerender } = render(<LibraryView />)

    expect(screen.getByText('Entity 0')).toBeDefined()
    expect(screen.queryByText('Entity 29')).toBeNull()
    expect(screen.getAllByText(/Showing 24 of 30 entities/).length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByRole('button', { name: 'Show all 30 entities' }))
    expect(mockSetShowAll).toHaveBeenCalledWith(true)

    libraryViewState.currentShowAll = true
    rerender(<LibraryView />)
    expect(screen.getByText('Entity 29')).toBeDefined()
    expect(screen.getAllByText(/Showing 30 of 30 entities/).length).toBeGreaterThanOrEqual(1)
  })
})
