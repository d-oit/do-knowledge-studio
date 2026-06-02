import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import GraphView from '../GraphView';

const mockSigmaInstance = {
  on: vi.fn(),
  kill: vi.fn(),
  refresh: vi.fn(),
  getCamera: vi.fn().mockReturnValue({
    ratio: 1,
    animatedReset: vi.fn(),
    setState: vi.fn(),
  }),
  getCanvases: vi.fn().mockReturnValue({}),
};

// Mock Sigma
vi.mock('sigma', () => {
  const MockSigma = vi.fn().mockImplementation(function() {
    return mockSigmaInstance;
  });
  return {
    default: MockSigma,
  };
});

// Mock dependencies
vi.mock('../../../db/repository', () => ({
  repository: {
    getClaimsByEntityId: vi.fn().mockResolvedValue([]),
    createSnapshot: vi.fn().mockResolvedValue({}),
    listSnapshots: vi.fn().mockResolvedValue([]),
    deleteEntity: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../../lib/jobs', () => ({
  jobCoordinator: {
    enqueue: vi.fn(),
    registerHandler: vi.fn(),
    unregisterHandler: vi.fn(),
  },
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

describe('GraphView', () => {
  const entities = [
    { id: '1', name: 'E1', type: 'concept' },
    { id: '2', name: 'E2', type: 'concept' },
  ];
  const links = [
    { id: 'l1', source_id: '1', target_id: '2', relation: 'rel' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', async () => {
    await act(async () => {
        render(<GraphView entities={entities} links={links} />);
    });
    expect(screen.getByRole('img')).toBeDefined();
  });

  it('shows toolbar by default', async () => {
    await act(async () => {
        render(<GraphView entities={entities} links={links} />);
    });
    expect(screen.getByTitle('Force-directed layout')).toBeDefined();
  });

  it('hides toolbar when hideToolbar is true', async () => {
    await act(async () => {
        render(<GraphView entities={entities} links={links} hideToolbar={true} />);
    });
    expect(screen.queryByTitle('Force-directed layout')).toBeNull();
  });

  it('handles focus mode toggle', async () => {
    const onFocusModeChange = vi.fn();
    await act(async () => {
        render(<GraphView entities={entities} links={links} onFocusModeChange={onFocusModeChange} selectedNode="1" />);
    });

    const focusBtn = screen.getByTitle('Toggle Neighborhood Focus');
    await act(async () => {
        fireEvent.click(focusBtn);
    });

    expect(onFocusModeChange).toHaveBeenCalledWith(true);
  });
});
