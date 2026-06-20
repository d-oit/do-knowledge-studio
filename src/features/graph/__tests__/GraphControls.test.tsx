import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { renderWithDb } from '../../../test/test-utils';
import { repository } from '../../../db/repository';

vi.mock('@tanstack/react-virtual', () => {
  const items: { index: number; start: number; end: number; key: number }[] = [];
  return {
    useVirtualizer: (opts: { count: number; estimateSize: () => number }) => {
      if (items.length !== opts.count) {
        items.length = opts.count;
        for (let i = 0; i < opts.count; i++) {
          const size = opts.estimateSize();
          items[i] = { index: i, start: i * size, end: (i + 1) * size, key: i };
        }
      }
      return {
        getVirtualItems: () => items,
        getTotalSize: () => items.length * 100,
        measureElement: vi.fn(),
      };
    },
  };
});

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../db/repository', () => ({
  repository: {
    listSnapshots: vi.fn().mockResolvedValue([
      { id: 'snap-1', name: 'Snapshot 1', description: 'First snapshot', created_at: '2026-01-01T00:00:00Z' },
      { id: 'snap-2', name: 'Snapshot 2', description: null, created_at: '2026-01-02T00:00:00Z' },
    ]),
    getSnapshot: vi.fn().mockResolvedValue({
      id: 'snap-1', name: 'Snapshot 1',
      nodes_json: '[{"id":"n1","label":"Node 1"}]',
      edges_json: '[{"id":"e1","source":"n1","target":"n2"}]',
    }),
    diffSnapshots: vi.fn().mockResolvedValue({
      added_nodes: [], removed_nodes: [], added_edges: [], removed_edges: [],
    }),
  },
}));

vi.mock('../../../hooks/useFocusTrap', () => ({ useFocusTrap: vi.fn() }));
vi.mock('../../../hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
vi.mock('../../../hooks/useScrollLock', () => ({ useScrollLock: vi.fn() }));
vi.mock('../../../hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));

import GraphControls from '../GraphControls';

describe('GraphControls', () => {
  const defaultProps = {
    focusMode: false,
    setFocusMode: vi.fn(),
    hasSelection: false,
    onSaveSnapshot: vi.fn(),
    onLoadSnapshot: vi.fn(),
    onSnapshotModeChange: vi.fn(),
    onExportPNG: vi.fn(),
    layout: 'force' as const,
    onLayoutChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows primary buttons always visible', () => {
    renderWithDb(<GraphControls {...defaultProps} />, { repository });
    expect(screen.getByTitle('Select a node first')).toBeDefined();
    expect(screen.getByTitle('Export graph as PNG image')).toBeDefined();
    expect(screen.getByTitle('Save Graph Snapshot')).toBeDefined();
    expect(screen.getByTitle('Load or diff saved snapshots')).toBeDefined();
  });

  it('shows layout toggle buttons', () => {
    renderWithDb(<GraphControls {...defaultProps} />, { repository });
    expect(screen.getByTitle('Circular layout')).toBeDefined();
    expect(screen.getByTitle('Force-directed layout')).toBeDefined();
    expect(screen.getByTitle('Hierarchical layout')).toBeDefined();
  });

  it('toggles to circular layout on button click', () => {
    renderWithDb(<GraphControls {...defaultProps} />, { repository });
    fireEvent.click(screen.getByTitle('Circular layout'));
    expect(defaultProps.onLayoutChange).toHaveBeenCalledWith('circular');
  });

  it('toggles to hierarchical layout on button click', () => {
    renderWithDb(<GraphControls {...defaultProps} />, { repository });
    fireEvent.click(screen.getByTitle('Hierarchical layout'));
    expect(defaultProps.onLayoutChange).toHaveBeenCalledWith('hierarchical');
  });

  it('triggers focus mode toggle', () => {
    renderWithDb(<GraphControls {...defaultProps} hasSelection={true} />, { repository });
    fireEvent.click(screen.getByTitle('Toggle Neighborhood Focus'));
    expect(defaultProps.setFocusMode).toHaveBeenCalledWith(true);
  });

  it('triggers export PNG on button click', () => {
    renderWithDb(<GraphControls {...defaultProps} />, { repository });
    fireEvent.click(screen.getByTitle('Export graph as PNG image'));
    expect(defaultProps.onExportPNG).toHaveBeenCalled();
  });

  it('opens snapshot browser and renders snapshots via virtualizer', async () => {
    renderWithDb(<GraphControls {...defaultProps} />, { repository });
    fireEvent.click(screen.getByTitle('Load or diff saved snapshots'));
    await waitFor(() => {
      expect(screen.getByText('Snapshot 1')).toBeDefined();
      expect(screen.getByText('Snapshot 2')).toBeDefined();
    });
    const compareBtn = screen.getByText('Compare Selected');
    expect(compareBtn).toBeDefined();
  });

  it('shows loading state when fetching snapshots', async () => {
    const { repository } = await import('../../../db/repository');

    vi.mocked(repository.listSnapshots).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 100))
    );
    renderWithDb(<GraphControls {...defaultProps} />, { repository });
    fireEvent.click(screen.getByTitle('Load or diff saved snapshots'));
    expect(screen.getByText('Loading snapshots...')).toBeDefined();
  });

  it('displays empty state when no snapshots exist', async () => {
    vi.mocked(repository.listSnapshots).mockResolvedValue([]);
    renderWithDb(<GraphControls {...defaultProps} />, { repository });
    fireEvent.click(screen.getByTitle('Load or diff saved snapshots'));
    await waitFor(() => {
      expect(screen.getByText(/No snapshots saved yet/)).toBeDefined();
    });
  });
});
