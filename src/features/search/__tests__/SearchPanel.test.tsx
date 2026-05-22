import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchPanel from '../SearchPanel';
import * as searchLib from '../../../lib/search';
import React from 'react';

vi.mock('../../../lib/search', () => ({
  searchKnowledge: vi.fn(),
  semanticSearch: vi.fn(),
  initEmbeddings: vi.fn(),
}));

describe('SearchPanel UX Improvements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears the search query and focuses the input when the clear button is clicked', async () => {
    render(<SearchPanel />);
    const input = screen.getByLabelText('Search knowledge base') as HTMLInputElement;

    // Type something to make clear button appear
    fireEvent.change(input, { target: { value: 'test' } });
    expect(input.value).toBe('test');

    const clearBtn = screen.getByLabelText('Clear search');
    expect(clearBtn).toBeDefined();

    // Click clear
    fireEvent.click(clearBtn);

    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('updates search results using the correct type category when a filter chip is selected', async () => {
    const mockedSearch = vi.mocked(searchLib.searchKnowledge);
    mockedSearch.mockResolvedValue([]);

    render(<SearchPanel />);
    const input = screen.getByLabelText('Search knowledge base');

    // Type query
    fireEvent.change(input, { target: { value: 'test' } });

    // Wait for debounce
    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledWith('test', { type: undefined });
    });

    // Click "Entities" filter
    const entitiesFilter = screen.getByRole('button', { name: 'Entities' });
    fireEvent.click(entitiesFilter);

    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledWith('test', { type: 'entity' });
    });
  });

  it('updates selected result index and ARIA attributes with keyboard navigation', async () => {
    const mockedSearch = vi.mocked(searchLib.searchKnowledge);
    mockedSearch.mockResolvedValue([
      { id: '1', name: 'Result 1', type: 'entity', excerpt: 'Content 1', score: 1, stage: 'verified' as const },
      { id: '2', name: 'Result 2', type: 'entity', excerpt: 'Content 2', score: 1, stage: 'verified' as const },
    ]);

    render(<SearchPanel />);
    const input = screen.getByLabelText('Search knowledge base');

    fireEvent.change(input, { target: { value: 'test' } });

    // Wait for results
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    // Initially none selected
    expect(input).not.toHaveAttribute('aria-activedescendant');

    // Press ArrowDown
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', 'result-0');
    });

    // Press ArrowDown again
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', 'result-1');
    });
  });

  it('displays appropriate provenance tags based on the result stage', async () => {
    const mockedSearch = vi.mocked(searchLib.searchKnowledge);
    mockedSearch.mockResolvedValue([
      { id: '1', name: 'Verified Result', type: 'entity', excerpt: 'Content', score: 1, stage: 'verified' as const },
      { id: '2', name: 'Draft Result', type: 'entity', excerpt: 'Content', score: 1, stage: 'draft' as const },
    ]);

    render(<SearchPanel />);
    fireEvent.change(screen.getByLabelText('Search knowledge base'), { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('verified')).toBeDefined();
      expect(screen.getByText('draft')).toBeDefined();
    });
  });

  it('debounces searchKnowledge calls', async () => {
    const mockedSearch = vi.mocked(searchLib.searchKnowledge);
    render(<SearchPanel />);
    const input = screen.getByLabelText('Search knowledge base');

    fireEvent.change(input, { target: { value: 't' } });
    fireEvent.change(input, { target: { value: 'te' } });
    fireEvent.change(input, { target: { value: 'tes' } });
    fireEvent.change(input, { target: { value: 'test' } });

    // Wait for debounce time
    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledTimes(1);
    }, { timeout: 1000 });
  });
});
