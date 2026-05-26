import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock @tanstack/react-virtual for virtualization tests
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
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../db/repository', () => ({
  repository: {
    listSnapshots: vi.fn().mockResolvedValue([
      { id: 'snap-1', name: 'Snapshot 1', description: 'First snapshot', created_at: '2026-01-01T00:00:00Z' },
      { id: 'snap-2', name: 'Snapshot 2', description: null, created_at: '2026-01-02T00:00:00Z' },
    ]),
    getSnapshot: vi.fn().mockResolvedValue({
      id: 'snap-1',
      name: 'Snapshot 1',
      nodes_json: '[{"id":"n1","label":"Node 1"}]',
      edges_json: '[{"id":"e1","source":"n1","target":"n2"}]',
    }),
    diffSnapshots: vi.fn().mockResolvedValue({
      added_nodes: [],
      removed_nodes: [],
      added_edges: [],
      removed_edges: [],
    }),
  },
}));

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

vi.mock('../../../hooks/useEscapeKey', () => ({
  useEscapeKey: vi.fn(),
}));

vi.mock('../../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => false, // Desktop by default
}));

import GraphControls from '../GraphControls';

describe('GraphControls Progressive Disclosure (#143)', () => {
  const defaultProps = {
    focusMode: false,
    setFocusMode: vi.fn(),
    hasSelection: false,
    onSaveSnapshot: vi.fn(),
    onLoadSnapshot: vi.fn(),
    onSnapshotModeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides Load Snapshot button when More is collapsed', () => {
    render(<GraphControls {...defaultProps} />);

    const moreBtn = screen.getByTitle('More graph controls');
    expect(moreBtn).toBeDefined();
    expect(moreBtn).toHaveAttribute('aria-expanded', 'false');

    // Load Snapshot should not be visible
    const loadBtn = screen.queryByTitle('Load or diff saved snapshots');
    expect(loadBtn).toBeNull();
  });

  it('shows Load Snapshot button when More is expanded', () => {
    render(<GraphControls {...defaultProps} />);

    const moreBtn = screen.getByTitle('More graph controls');
    fireEvent.click(moreBtn);

    expect(moreBtn).toHaveAttribute('aria-expanded', 'true');

    // Load Snapshot should now be visible
    const loadBtn = screen.getByTitle('Load or diff saved snapshots');
    expect(loadBtn).toBeDefined();
  });

  it('toggles More controls on repeated clicks', () => {
    render(<GraphControls {...defaultProps} />);

    const moreBtn = screen.getByTitle('More graph controls');

    // First click — expand
    fireEvent.click(moreBtn);
    expect(screen.getByTitle('Load or diff saved snapshots')).toBeDefined();

    // Second click — collapse
    fireEvent.click(moreBtn);
    expect(screen.queryByTitle('Load or diff saved snapshots')).toBeNull();
  });

  it('always shows primary controls (Focus, Save Snapshot)', () => {
    render(<GraphControls {...defaultProps} hasSelection={true} selectedName="Test Node" />);

    // Focus button should always be visible
    expect(screen.getByText(/Focus Neighborhood/)).toBeDefined();

    // Save Snapshot button should always be visible
    expect(screen.getByTitle('Save Graph Snapshot')).toBeDefined();
  });
});

describe('GraphControls Snapshot Virtualization (#138)', () => {
  const defaultProps = {
    focusMode: false,
    setFocusMode: vi.fn(),
    hasSelection: false,
    onSaveSnapshot: vi.fn(),
    onLoadSnapshot: vi.fn(),
    onSnapshotModeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens snapshot browser and renders snapshots via virtualizer', async () => {
    render(<GraphControls {...defaultProps} />);

    // Expand More and click Load Snapshot
    fireEvent.click(screen.getByTitle('More graph controls'));
    fireEvent.click(screen.getByTitle('Load or diff saved snapshots'));

    await waitFor(() => {
      // Snapshot names should be rendered
      expect(screen.getByText('Snapshot 1')).toBeDefined();
      expect(screen.getByText('Snapshot 2')).toBeDefined();
    });

    // Compare button should be present (initially disabled with 0 selected)
    const compareBtn = screen.getByText('Compare Selected');
    expect(compareBtn).toBeDefined();
  });

  it('shows loading state when fetching snapshots', async () => {
    const { repository } = await import('../../../db/repository');
    // Make listSnapshots take time
    vi.mocked(repository.listSnapshots).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 100))
    );

    render(<GraphControls {...defaultProps} />);

    fireEvent.click(screen.getByTitle('More graph controls'));
    fireEvent.click(screen.getByTitle('Load or diff saved snapshots'));

    // Loading state should appear immediately
    expect(screen.getByText('Loading snapshots...')).toBeDefined();
  });

  it('displays empty state when no snapshots exist', async () => {
    const { repository } = await import('../../../db/repository');
    vi.mocked(repository.listSnapshots).mockResolvedValue([]);

    render(<GraphControls {...defaultProps} />);

    fireEvent.click(screen.getByTitle('More graph controls'));
    fireEvent.click(screen.getByTitle('Load or diff saved snapshots'));

    await waitFor(() => {
      expect(screen.getByText(/No snapshots saved yet/)).toBeDefined();
    });
  });
});
