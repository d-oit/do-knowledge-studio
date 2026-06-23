import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
  progressiveSearch: vi.fn((_query: string, onResults: (rs: unknown, stage: string) => void) => {
    onResults([], 'exact');
    return Promise.resolve();
  }),
  initEmbeddings: vi.fn(),
}));

vi.mock('../../../db/useRepository', () => {
  const stable = {
    listTags: vi.fn().mockResolvedValue([]),
    getEntitiesByTagId: vi.fn().mockResolvedValue([]),
  };
  return {
    useRepository: () => stable,
  };
});

vi.mock('../../../db/repository/tags', () => ({}));

import SearchPanel from '../SearchPanel';

const findCreateCta = () => screen.getByRole('button', { name: /Create new entity/i });

describe('SearchPanel F5: Create new entity from query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the trimmed query to onCreateEntity when CTA is clicked', async () => {
    const handle = vi.fn();
    render(<SearchPanel onCreateEntity={handle} />);

    const input = screen.getByLabelText('Search knowledge base');
    fireEvent.change(input, { target: { value: 'quantum physics' } });

    await waitFor(() => { findCreateCta(); });

    fireEvent.click(findCreateCta());

    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith('quantum physics');
  });

  it('falls back to a generic seed name when query is blank', async () => {
    const handle = vi.fn();
    render(<SearchPanel onCreateEntity={handle} />);

    const input = screen.getByLabelText('Search knowledge base');
    fireEvent.change(input, { target: { value: 'xy' } });

    await waitFor(() => { findCreateCta(); });

    fireEvent.click(findCreateCta());

    expect(handle).toHaveBeenCalledTimes(1);
    const firstCall: unknown[] = handle.mock.calls[0] ?? [];
    const arg: unknown = firstCall[0];
    expect(typeof arg).toBe('string');
    expect((arg as string).length).toBeGreaterThan(0);
  });
});

