import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  libraryViewState,
  getMockSearchSemantic,
  mockSetSemanticSearchEnabled,
  resetLibraryViewMocks,
  SEMANTIC_DEBOUNCE_PROBE_MS,
} from './library-view.test-helpers'
import { LibraryView } from './library-view'
const mockSearchSemantic = getMockSearchSemantic()

describe('LibraryView semantic search', () => {
  beforeEach(resetLibraryViewMocks)

  it('semantic toggle drives the store action', () => {
    render(<LibraryView />)
    fireEvent.click(screen.getByRole('switch', { name: 'Semantic search' }))
    expect(mockSetSemanticSearchEnabled).toHaveBeenCalledWith(true)
  })

  it('passes the active type filter into the semantic search', async () => {
    vi.useFakeTimers()
    try {
      libraryViewState.currentSemanticSearchEnabled = true
      libraryViewState.currentSearchQuery = 'triz'
      libraryViewState.currentTypeFilter = 'note'
      mockSearchSemantic.mockResolvedValue({ source: 'semantic', results: [] })

      render(<LibraryView />)
      await act(async () => {
        vi.advanceTimersByTime(SEMANTIC_DEBOUNCE_PROBE_MS)
      })

      expect(mockSearchSemantic).toHaveBeenCalledTimes(1)
      const filter = mockSearchSemantic.mock.calls[0]?.[5]
      expect(filter?.({ id: 'e1', type: 'entity', entityType: 'note' })).toBe(true)
      expect(filter?.({ id: 'e2', type: 'entity', entityType: 'concept' })).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-runs the semantic search when the type filter changes', async () => {
    vi.useFakeTimers()
    try {
      libraryViewState.currentSemanticSearchEnabled = true
      libraryViewState.currentSearchQuery = 'triz'
      libraryViewState.currentTypeFilter = 'note'
      mockSearchSemantic.mockResolvedValue({ source: 'semantic', results: [] })

      const { rerender } = render(<LibraryView />)
      await act(async () => {
        vi.advanceTimersByTime(SEMANTIC_DEBOUNCE_PROBE_MS)
      })
      expect(mockSearchSemantic).toHaveBeenCalledTimes(1)

      libraryViewState.currentTypeFilter = 'concept'
      rerender(<LibraryView />)
      await act(async () => {
        vi.advanceTimersByTime(SEMANTIC_DEBOUNCE_PROBE_MS)
      })

      expect(mockSearchSemantic).toHaveBeenCalledTimes(2)
      const filter = mockSearchSemantic.mock.calls[1]?.[5]
      expect(filter?.({ id: 'e1', type: 'entity', entityType: 'concept' })).toBe(true)
      expect(filter?.({ id: 'e2', type: 'entity', entityType: 'note' })).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
