import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import MindMapView from '../MindMapView';
import { repository } from '../../../db/repository';

// Mock MindElixir
const mockBus = {
  addListener: vi.fn(),
};
const mockMindInstance = {
  init: vi.fn(),
  bus: mockBus,
  findEle: vi.fn(),
  addChild: vi.fn().mockResolvedValue(undefined),
  insertSibling: vi.fn().mockResolvedValue(undefined),
  beginEdit: vi.fn().mockResolvedValue(undefined),
  removeNodes: vi.fn().mockResolvedValue(undefined),
  exportPng: vi.fn().mockResolvedValue(new Blob()),
};

vi.mock('mind-elixir', () => {
  const MockMindElixir = vi.fn().mockImplementation(function() {
    return mockMindInstance;
  });
  return {
    default: MockMindElixir,
  };
});

vi.mock('../../../db/repository', () => ({
  repository: {
    createEntity: vi.fn(),
    createLink: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
  },
}));

vi.mock('../../../lib/search', () => ({
  upsertToSearchIndex: vi.fn(),
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

// Mock perf to avoid dev check if needed
vi.mock('../../../lib/perf', () => ({
  perf: { mark: vi.fn(), measure: vi.fn() }
}));

describe('MindMapView', () => {
  const rootEntity = { id: '1', name: 'Root', type: 'note' as const };
  const entities = [rootEntity, { id: '2', name: 'Child', type: 'note' as const }];
  const links = [{ id: 'l1', source_id: '1', target_id: '2', relation: 'hierarchy' }];

  beforeEach(() => {
    vi.clearAllMocks();
    mockMindInstance.findEle.mockReturnValue({ nodeObj: { id: 'temp' } });
  });

  it('renders correctly', () => {
    render(
      <MindMapView
        rootEntity={rootEntity}
        entities={entities}
        links={links}
        relatedEntities={[]}
      />
    );
    expect(screen.getByLabelText('Select root entity')).toBeDefined();
    expect(screen.getByText('Add Child')).toBeDefined();
  });

  it('triggers mindmap operations when bus emits events', async () => {
    render(
      <MindMapView
        rootEntity={rootEntity}
        entities={entities}
        links={links}
        relatedEntities={[]}
      />
    );

    await waitFor(() => {
        expect(mockBus.addListener).toHaveBeenCalledWith('operation', expect.any(Function));
    });

    const operationListener = mockBus.addListener.mock.calls.find(call => call[0] === 'operation')?.[1];

    vi.mocked(repository.createEntity).mockResolvedValue({ id: '3', name: 'New Node', type: 'note' });

    await act(async () => {
        await operationListener({
            name: 'addChild',
            obj: { id: 'temp-id', topic: 'New Node', parent: { id: '1' } }
        });
    });

    expect(repository.createEntity).toHaveBeenCalled();
    expect(repository.createLink).toHaveBeenCalled();
  });

  it('handles rename operation', async () => {
    render(
      <MindMapView
        rootEntity={rootEntity}
        entities={entities}
        links={links}
        relatedEntities={[]}
      />
    );

    await waitFor(() => {
        expect(mockBus.addListener).toHaveBeenCalledWith('selectNode', expect.any(Function));
    });

    const selectNodeListener = mockBus.addListener.mock.calls.find(call => call[0] === 'selectNode')?.[1];

    await act(async () => {
        selectNodeListener({ id: '2' });
    });

    const btn = await screen.findByLabelText('Rename selected node');
    await act(async () => {
        fireEvent.click(btn);
    });

    expect(mockMindInstance.beginEdit).toHaveBeenCalled();
  });

  it('handles delete operation', async () => {
    render(
      <MindMapView
        rootEntity={rootEntity}
        entities={entities}
        links={links}
        relatedEntities={[]}
      />
    );

    await waitFor(() => {
        expect(mockBus.addListener).toHaveBeenCalledWith('selectNode', expect.any(Function));
    });

    const selectNodeListener = mockBus.addListener.mock.calls.find(call => call[0] === 'selectNode')?.[1];

    await act(async () => {
        selectNodeListener({ id: '2' });
    });

    const btn = await screen.findByLabelText('Delete selected node');
    await act(async () => {
        mockMindInstance.findEle.mockReturnValue({});
        fireEvent.click(btn);
    });

    expect(mockMindInstance.removeNodes).toHaveBeenCalled();
  });
});
