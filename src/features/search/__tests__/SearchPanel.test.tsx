import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchPanel from '../SearchPanel';
import * as searchLib from '../../../lib/search';
import React from 'react';

vi.mock('@tanstack/react-virtual', () => {
  const items: { index: number; start: number; end: number; key: number }[] = [];
  return {
    useVirtualizer: (opts: { count: number; estimateSize: (i: number) => number }) => {
      if (items.length !== opts.count) {
        items.length = opts.count;
        for (let i = 0; i < opts.count; i++) {
          const size = typeof opts.estimateSize === 'function' ? opts.estimateSize(i) : 72;
          items[i] = { index: i, start: i * size, end: (i + 1) * size, key: i };
        }
      }
      return {
        getVirtualItems: () => items,
        getTotalSize: () => items.length * 72,
      };
    },
  };
});

vi.mock('../../../lib/search', () => ({
  progressiveSearch: vi.fn((_query: string, onResults: searchLib.ProgressiveSearchCallback, _options?: { type?: string; signal?: AbortSignal }) => {
    onResults([], 'exact');
    return Promise.resolve();
  }),
  initEmbeddings: vi.fn(),
}));

describe('SearchPanel UX Improvements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears the search query and focuses the input when the clear button is clicked', () => {
    render(<SearchPanel />);
    const input = screen.getByLabelText('Search knowledge base');

    fireEvent.change(input, { target: { value: 'test' } });
    expect(input.value).toBe('test');

    const clearBtn = screen.getByLabelText('Clear search');
    expect(clearBtn).toBeDefined();

    fireEvent.click(clearBtn);

    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('updates search results using the correct type category when a filter chip is selected', async () => {
    const mockedSearch = vi.mocked(searchLib.progressiveSearch);

    render(<SearchPanel />);
    const input = screen.getByLabelText('Search knowledge base');

    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledWith('test', expect.any(Function), expect.objectContaining({ type: undefined }));
    });

    const entitiesFilter = screen.getByRole('button', { name: 'Entities' });
    fireEvent.click(entitiesFilter);

    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledWith('test', expect.any(Function), expect.objectContaining({ type: 'entity' }));
    });
  });

  it('updates selected result index and ARIA attributes with keyboard navigation', async () => {
    const mockedSearch = vi.mocked(searchLib.progressiveSearch);
    mockedSearch.mockImplementation((_query: string, onResults: searchLib.ProgressiveSearchCallback) => {
      onResults([
        { id: '1', name: 'Result 1', type: 'entity', excerpt: 'Content 1', score: 1, stage: 'verified' },
        { id: '2', name: 'Result 2', type: 'entity', excerpt: 'Content 2', score: 1, stage: 'verified' },
      ], 'exact');
      return Promise.resolve();
    });

    render(<SearchPanel />);
    const input = screen.getByLabelText('Search knowledge base');

    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', 'result-0');
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', 'result-1');
    });
  });

  it('displays appropriate provenance tags based on the result stage', async () => {
    const mockedSearch = vi.mocked(searchLib.progressiveSearch);
    mockedSearch.mockImplementation((_query: string, onResults: searchLib.ProgressiveSearchCallback) => {
      onResults([
        { id: '1', name: 'Verified Result', type: 'entity', excerpt: 'Content', score: 1, stage: 'verified' },
        { id: '2', name: 'Draft Result', type: 'entity', excerpt: 'Content', score: 1, stage: 'draft' },
      ], 'exact');
      return Promise.resolve();
    });

    render(<SearchPanel />);
    fireEvent.change(screen.getByLabelText('Search knowledge base'), { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('verified')).toBeDefined();
      expect(screen.getByText('draft')).toBeDefined();
    });
  });

  it('debounces progressiveSearch calls', async () => {
    const mockedSearch = vi.mocked(searchLib.progressiveSearch);
    render(<SearchPanel />);
    const input = screen.getByLabelText('Search knowledge base');

    fireEvent.change(input, { target: { value: 't' } });
    fireEvent.change(input, { target: { value: 'te' } });
    fireEvent.change(input, { target: { value: 'tes' } });
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledTimes(1);
    }, { timeout: 1000 });
  });

  describe('Search mode toggle', () => {
    it('shows Keyword and Semantic mode buttons', () => {
      render(<SearchPanel />);

      const keywordBtn = screen.getByText('Keyword');
      const semanticBtn = screen.getByText('Semantic');
      expect(keywordBtn).toBeDefined();
      expect(semanticBtn).toBeDefined();
    });

    it('toggles between Keyword and Semantic modes', () => {
      render(<SearchPanel />);

      const keywordBtn = screen.getByText('Keyword');
      const semanticBtn = screen.getByText('Semantic');

      // Keyword should be active by default
      expect(keywordBtn).toHaveAttribute('aria-pressed', 'true');
      expect(semanticBtn).toHaveAttribute('aria-pressed', 'false');

      // Click Semantic
      fireEvent.click(semanticBtn);
      expect(keywordBtn).toHaveAttribute('aria-pressed', 'false');
      expect(semanticBtn).toHaveAttribute('aria-pressed', 'true');

      // Click Keyword again
      fireEvent.click(keywordBtn);
      expect(keywordBtn).toHaveAttribute('aria-pressed', 'true');
      expect(semanticBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
