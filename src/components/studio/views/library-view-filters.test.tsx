import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  libraryViewState,
  mockEntities,
  mockSetHasDescriptionOnly,
  mockSetSearchQuery,
  mockSetSortBy,
  mockSetSortDir,
  mockSetTagQuery,
  mockSetTypeFilter,
  resetLibraryViewMocks,
} from './library-view.test-helpers'
import { LibraryView } from './library-view'

describe('LibraryView filters', () => {
  beforeEach(resetLibraryViewMocks)

  it('search input exists and has correct placeholder and accessible name', () => {
    render(<LibraryView />)
    expect(screen.getByPlaceholderText('Filter by name, description, or tag…')).toBeDefined()
    const input = screen.getByLabelText('Search library')
    expect(input).toBeDefined()
    expect(input.className).toContain('min-h-touch')
  })

  it('control buttons expose matching tooltips', () => {
    libraryViewState.currentSearchQuery = 'alpha'
    render(<LibraryView />)
    expect(screen.getByRole('button', { name: 'Clear search' })).toHaveAttribute('title', 'Clear search')
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('title', 'Grid view')
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('title', 'List view')
    expect(screen.getByRole('button', { name: 'Sort ascending' })).toHaveAttribute('title', 'Sort ascending')
  })

  it('updates the search query and clears an active search', () => {
    libraryViewState.currentSearchQuery = 'alpha'
    render(<LibraryView />)
    fireEvent.change(screen.getByLabelText('Search library'), { target: { value: 'beta' } })
    expect(mockSetSearchQuery).toHaveBeenCalledWith('beta')

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(mockSetSearchQuery).toHaveBeenCalledWith('')
  })

  it('clears all filters from the no-matches state', () => {
    libraryViewState.currentSearchQuery = 'missing'
    libraryViewState.currentTypeFilter = 'concept'
    libraryViewState.currentTagQuery = 'alpha'
    libraryViewState.currentHasDescriptionOnly = true
    libraryViewState.filteredEntities = []
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(mockSetSearchQuery).toHaveBeenCalledWith('')
    expect(mockSetTypeFilter).toHaveBeenCalledWith('all')
    expect(mockSetTagQuery).toHaveBeenCalledWith('')
    expect(mockSetHasDescriptionOnly).toHaveBeenCalledWith(false)
  })

  it('changes type, sort, and sort direction controls', () => {
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }))
    expect(mockSetTypeFilter).toHaveBeenCalledWith('note')

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
      target: { value: 'name' },
    })
    expect(mockSetSortBy).toHaveBeenCalledWith('name')

    fireEvent.click(screen.getByRole('button', { name: 'Sort ascending' }))
    expect(mockSetSortDir).toHaveBeenCalledWith('desc')
  })

  it('advanced filters disclosure is collapsed by default', () => {
    render(<LibraryView />)
    const toggle = screen.getByRole('button', { name: /Advanced filters/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Tag contains')).toBeNull()
  })

  it('opens advanced filters and filters by tag', () => {
    libraryViewState.currentTagQuery = 'alpha'
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /Advanced filters/i }))
    expect(screen.getByLabelText('Tag contains')).toBeDefined()

    const tagInput = screen.getByLabelText('Tag contains')
    expect(tagInput).toHaveValue('alpha')
    fireEvent.change(tagInput, { target: { value: 'beta' } })
    expect(mockSetTagQuery).toHaveBeenCalledWith('beta')
    expect(screen.getByText('Alpha Concept')).toBeDefined()
    expect(screen.queryByText('Beta Note')).toBeNull()
  })

  it('filters to entities with descriptions when toggled', () => {
    libraryViewState.filteredEntities = [
      mockEntities[0],
      { ...mockEntities[1], description: '' },
    ]
    libraryViewState.currentHasDescriptionOnly = true
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /Advanced filters/i }))
    const checkbox = screen.getByLabelText('Only show entities with a description')
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(checkbox)
    expect(mockSetHasDescriptionOnly).toHaveBeenCalledWith(false)
    expect(screen.getByText('Alpha Concept')).toBeDefined()
    expect(screen.queryByText('Beta Note')).toBeNull()
  })

  it('shows active-filter badge and clears advanced filters', () => {
    libraryViewState.currentTagQuery = 'alpha'
    const { rerender } = render(<LibraryView />)
    fireEvent.click(screen.getByRole('button', { name: /Advanced filters/i }))

    expect(screen.getByText('1')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Clear advanced filters' }))
    expect(mockSetTagQuery).toHaveBeenCalledWith('')
    expect(mockSetHasDescriptionOnly).toHaveBeenCalledWith(false)

    libraryViewState.currentTagQuery = ''
    rerender(<LibraryView />)
    expect(screen.getByLabelText('Tag contains')).toHaveValue('')
    expect(screen.getByText('Alpha Concept')).toBeDefined()
    expect(screen.getByText('Beta Note')).toBeDefined()
  })
})
