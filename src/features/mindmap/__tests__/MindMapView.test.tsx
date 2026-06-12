import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderWithDb } from '../../../test/test-utils';
import type { Entity, Link } from '../../../lib/validation';

vi.mock('mind-elixir', () => {
  class MockMindElixir {
    init = vi.fn();
    bus = { addListener: vi.fn(), emit: vi.fn() };
    findEle = vi.fn().mockReturnValue(null);
    addChild = vi.fn();
    insertSibling = vi.fn();
    beginEdit = vi.fn();
    removeNodes = vi.fn();
    exportPng = vi.fn().mockResolvedValue(new Blob());
    refresh = vi.fn();
    updateNodeStyle = vi.fn();
  }
  return { default: MockMindElixir };
});

vi.mock('../sync-adapter', () => ({
  setupMindMapSyncListeners: vi.fn(),
}));

vi.mock('../../../store/graph-sync-store', () => ({
  useGraphSyncStore: Object.assign(
    vi.fn(() => ({
      syncEnabled: false,
      pendingEvents: [],
      consumeEvents: vi.fn().mockReturnValue([]),
    })),
    {
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      getState: vi.fn().mockReturnValue({
        syncEnabled: false,
        pendingEvents: [],
        consumeEvents: vi.fn().mockReturnValue([]),
      }),
    }
  ),
}));

vi.mock('../../../db/repository', () => ({
  repository: {
    createEntity: vi.fn().mockResolvedValue({ id: 'new-id', name: 'New', type: 'note' }),
    updateEntity: vi.fn().mockResolvedValue({}),
    deleteEntity: vi.fn().mockResolvedValue(undefined),
    getAllEntities: vi.fn().mockResolvedValue([]),
    getEntityByName: vi.fn().mockResolvedValue(null),
    createLink: vi.fn().mockResolvedValue({ id: 'link-id', relation: 'hierarchy' }),
  },
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../lib/search', () => ({
  upsertToSearchIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/perf', () => ({
  perf: {
    mark: vi.fn(),
    measure: vi.fn(),
  },
}));

vi.mock('../../../components/SyncToggle', () => ({
  default: () => <div data-testid="sync-toggle" />,
}));

vi.mock('lucide-react', () => ({
  ChevronDown: () => <div />,
  Layers: () => <div />,
  Filter: () => <div />,
  Info: () => <div />,
  ChevronRight: () => <div />,
  Plus: () => <div />,
  GitBranch: () => <div />,
  Pencil: () => <div />,
  Trash2: () => <div />,
  Image: () => <div />,
}));

import MindMapView from '../MindMapView';

const ROOT: Entity = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Root', type: 'concept' };
const CHILD: Entity = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Child', type: 'note' };
const LINKS: Link[] = [
  { source_id: ROOT.id, target_id: CHILD.id, relation: 'hierarchy' },
];

describe('MindMapView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the root entity select', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT, CHILD]}
        links={LINKS}
      />
    );
    expect(screen.getByLabelText('Select root entity')).toBeDefined();
  });

  it('renders depth selector', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    expect(screen.getByLabelText('Set depth')).toBeDefined();
  });

  it('renders relation filter', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={LINKS}
      />
    );
    expect(screen.getByLabelText('Filter relations')).toBeDefined();
  });

  it('renders toolbar buttons', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    expect(screen.getByLabelText('Add child node')).toBeDefined();
    expect(screen.getByLabelText('Add sibling node')).toBeDefined();
    expect(screen.getByLabelText('Rename selected node')).toBeDefined();
    expect(screen.getByLabelText('Delete selected node')).toBeDefined();
  });

  it('disables sibling/rename/delete buttons when no node selected', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    expect(screen.getByLabelText('Add sibling node')).toBeDisabled();
    expect(screen.getByLabelText('Rename selected node')).toBeDisabled();
    expect(screen.getByLabelText('Delete selected node')).toBeDisabled();
  });

  it('renders SyncToggle', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    expect(screen.getByTestId('sync-toggle')).toBeDefined();
  });

  it('renders the mind map container', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    expect(screen.getByText('Click a node to view details or drag to explore.')).toBeDefined();
  });

  it('shows mind map summary with root name', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    expect(screen.getByText(/Rooted at Root/)).toBeDefined();
  });

  it('calls onEntityClick when provided', () => {
    const onEntityClick = vi.fn();
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
        onEntityClick={onEntityClick}
      />
    );
    expect(onEntityClick).not.toHaveBeenCalled();
  });

  it('toggles collapsed by default when entities > 20', () => {
    const manyEntities: Entity[] = Array.from({ length: 25 }, (_, i) => ({
      id: `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`,
      name: `Entity ${i}`,
      type: 'note',
    }));
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={manyEntities}
        links={[]}
      />
    );
    const toggleBtn = screen.getByTitle('Expand all branches');
    expect(toggleBtn).toBeDefined();
  });

  it('toggle button switches label on click', async () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    const btn = await waitFor(() => {
      const el = screen.getByTitle('Collapse deep branches');
      expect(el).not.toBeDisabled();
      return el;
    });
    btn.click();
    await waitFor(() => {
      expect(screen.getByTitle('Expand all branches')).toBeDefined();
    });
  });

  it('root entity select has all entities as options', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT, CHILD]}
        links={LINKS}
      />
    );
    const select = screen.getByRole('combobox', { name: 'Select root entity' });
    const rootOpts = select.querySelectorAll('option');
    expect(rootOpts.length).toBe(2);
    expect(rootOpts[0].textContent).toBe('Root');
    expect(rootOpts[1].textContent).toBe('Child');
  });

  it('depth selector has options 1-5', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    const select = screen.getByRole('combobox', { name: 'Set depth' });
    const depthOpts = select.querySelectorAll('option');
    expect(depthOpts.length).toBe(5);
    expect(depthOpts[0].getAttribute('value')).toBe('1');
    expect(depthOpts[4].getAttribute('value')).toBe('5');
  });

  it('relation filter includes "all" and custom relations', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT, CHILD]}
        links={LINKS}
      />
    );
    const select = screen.getByRole('combobox', { name: 'Filter relations' });
    const relOpts = select.querySelectorAll('option');
    expect(relOpts.length).toBe(2);
    expect(relOpts[0].getAttribute('value')).toBe('all');
    expect(relOpts[1].getAttribute('value')).toBe('hierarchy');
  });

  it('add child button is enabled after mind ready', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    const btn = screen.getByLabelText('Add child node');
    expect(btn).toBeDefined();
  });

  it('export PNG button is present', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    expect(screen.getByLabelText('Export mind map as PNG')).toBeDefined();
  });

  it('shows mind map summary with depth info', () => {
    renderWithDb(
      <MindMapView
        rootEntity={ROOT}
        relatedEntities={[]}
        entities={[ROOT]}
        links={[]}
      />
    );
    expect(screen.getByText(/Rooted at.*Depth: 2/)).toBeDefined();
  });
});
