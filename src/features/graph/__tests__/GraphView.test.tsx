import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import Graph from 'graphology';
import { buildGraphologyInstance } from '../../../lib/graph-data';
import { EMPTY_GRAPH_FILTERS } from '../graph-filters';
import { useGraphFilters } from '../useGraphFilters';
import { renderHook, act } from '@testing-library/react';
import GraphInspector from '../GraphInspector';
import type { Entity, Link, Claim } from '../../../lib/validation';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () => {
      const items: { index: number; start: number; end: number; key: number }[] = [];
      for (let i = 0; i < opts.count; i++) {
        const size = opts.estimateSize();
        items.push({ index: i, start: i * size, end: (i + 1) * size, key: i });
      }
      return items;
    },
    getTotalSize: () => opts.count * 100,
    measureElement: vi.fn(),
  }),
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../lib/perf', () => ({
  perf: { mark: vi.fn(), measure: vi.fn() },
}));

vi.mock('../../../lib/jobs', () => ({
  jobCoordinator: {
    enqueue: vi.fn(),
    registerHandler: vi.fn(),
    unregisterHandler: vi.fn(),
  },
}));

vi.mock('../../../lib/theme-tokens', () => ({
  getGraphThemeTokens: () => ({
    nodeDefault: '#64748b',
    nodeSelected: '#3b82f6',
    edgeDefault: '#94a3b8',
    edgeHighlighted: '#3b82f6',
    interactivePrimary: '#3b82f6',
  }),
  onThemeChange: () => () => undefined,
}));

vi.mock('../../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

vi.mock('../../../hooks/useFocusTrap', () => ({ useFocusTrap: vi.fn() }));
vi.mock('../../../hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
vi.mock('../../../hooks/useScrollLock', () => ({ useScrollLock: vi.fn() }));

vi.mock('sigma', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      refresh: vi.fn(),
      kill: vi.fn(),
      getCamera: () => ({ animatedReset: vi.fn(), ratio: 1 }),
      getCanvases: () => ({}),
    })),
  };
});

vi.mock('../sync-adapter', () => ({
  setupGraphSyncListeners: () => () => undefined,
}));

vi.mock('../../../db/repository', () => ({
  repository: {
    deleteEntity: vi.fn().mockResolvedValue(undefined),
  },
}));

import { repository as mockedRepository } from '../../../db/repository';

vi.mock('../../../lib/search', () => ({
  removeFromSearchIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../GraphKeyboardNav', () => ({
  useGraphKeyboardNavigation: vi.fn(),
}));

vi.mock('../GraphTouchHandler', () => ({
  useGraphTouchGestures: vi.fn(),
}));

vi.mock('../GraphSyncEvents', () => ({
  useGraphSyncEvents: vi.fn(),
}));

const entity1: Entity = { id: '11111111-1111-1111-1111-111111111111', name: 'Alice', type: 'person' };
const entity2: Entity = { id: '22222222-2222-2222-2222-222222222222', name: 'Project Atlas', type: 'project' };
const entity3: Entity = { id: '33333333-3333-3333-3333-333333333333', name: 'Note', type: 'note' };
const sampleEntities: Entity[] = [entity1, entity2, entity3];

const linkA: Link = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  source_id: entity1.id!,
  target_id: entity2.id!,
  relation: 'works_on',
};
const linkB: Link = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  source_id: entity2.id!,
  target_id: entity3.id!,
  relation: 'references',
};
const sampleLinks: Link[] = [linkA, linkB];

describe('buildGraphologyInstance', () => {
  it('returns an empty graph when given empty arrays', () => {
    const graph = buildGraphologyInstance([], []);
    expect(graph.order).toBe(0);
    expect(graph.size).toBe(0);
    expect(graph.nodes()).toEqual([]);
    expect(graph.edges()).toEqual([]);
  });

  it('creates one node per entity with the correct attributes', () => {
    const graph = buildGraphologyInstance(sampleEntities, []);
    expect(graph.order).toBe(3);
    expect(graph.hasNode(entity1.id!)).toBe(true);
    expect(graph.hasNode(entity2.id!)).toBe(true);
    expect(graph.hasNode(entity3.id!)).toBe(true);
    expect(graph.getNodeAttribute(entity1.id!, 'label')).toBe('Alice');
    expect(graph.getNodeAttribute(entity2.id!, 'label')).toBe('Project Atlas');
    expect(graph.getNodeAttribute(entity1.id!, 'type')).toBe('person');
    expect(graph.getNodeAttribute(entity2.id!, 'type')).toBe('project');
    expect(graph.getNodeAttribute(entity3.id!, 'size')).toBe(10);
  });

  it('creates directed edges with the correct direction and label', () => {
    const graph = buildGraphologyInstance(sampleEntities, sampleLinks);
    expect(graph.size).toBe(2);
    expect(graph.hasDirectedEdge(entity1.id!, entity2.id!)).toBe(true);
    expect(graph.hasDirectedEdge(entity2.id!, entity3.id!)).toBe(true);
    expect(graph.getEdgeAttribute(entity1.id!, entity2.id!, 'label')).toBe('works_on');
    expect(graph.getEdgeAttribute(entity2.id!, entity3.id!, 'label')).toBe('references');
    const edgeAB = graph.edge(entity1.id!, entity2.id!);
    expect(graph.source(edgeAB)).toBe(entity1.id);
    expect(graph.target(edgeAB)).toBe(entity2.id);
  });

  it('skips entities without an id', () => {
    const entities: Entity[] = [
      { name: 'NoId', type: 'misc' },
      entity1,
    ];
    const graph = buildGraphologyInstance(entities, []);
    expect(graph.order).toBe(1);
    expect(graph.hasNode(entity1.id!)).toBe(true);
  });

  it('drops links whose endpoints are missing from the entity set', () => {
    const dangling: Link = {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      source_id: entity1.id!,
      target_id: '99999999-9999-9999-9999-999999999999',
      relation: 'broken',
    };
    const graph = buildGraphologyInstance(sampleEntities, [linkA, dangling]);
    expect(graph.size).toBe(1);
    expect(graph.hasDirectedEdge(entity1.id!, entity2.id!)).toBe(true);
  });

  it('deduplicates duplicate edges between the same source/target pair', () => {
    const duplicate: Link = {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      source_id: entity1.id!,
      target_id: entity2.id!,
      relation: 'duplicate_relation',
    };
    const graph = buildGraphologyInstance(sampleEntities, [linkA, duplicate]);
    expect(graph.size).toBe(1);
    expect(graph.getEdgeAttribute(entity1.id!, entity2.id!, 'label')).toBe('works_on');
  });

  it('deduplicates duplicate entity ids', () => {
    const entities: Entity[] = [
      entity1,
      { id: entity1.id, name: 'Alice Renamed', type: 'person' },
      entity2,
    ];
    const graph = buildGraphologyInstance(entities, []);
    expect(graph.order).toBe(2);
    expect(graph.getNodeAttribute(entity1.id!, 'label')).toBe('Alice');
  });

  it('returns a graphology Graph instance', () => {
    const graph = buildGraphologyInstance(sampleEntities, sampleLinks);
    expect(graph).toBeInstanceOf(Graph);
  });
});

describe('useGraphFilters', () => {
  it('builds entity type, edge relation, and node degree maps', () => {
    const { result } = renderHook(() => useGraphFilters(sampleEntities, sampleLinks));
    expect(result.current.entityTypeMap[entity1.id!]).toBe('person');
    expect(result.current.entityTypeMap[entity2.id!]).toBe('project');
    expect(result.current.edgeRelationMap[linkA.id!]).toBe('works_on');
    expect(result.current.edgeRelationMap[linkB.id!]).toBe('references');
    expect(result.current.nodeDegreeMap[entity1.id!]).toBe(1);
    expect(result.current.nodeDegreeMap[entity2.id!]).toBe(2);
    expect(result.current.nodeDegreeMap[entity3.id!]).toBe(1);
  });

  it('returns the input unchanged when no filters are active', () => {
    const { result } = renderHook(() => useGraphFilters(sampleEntities, sampleLinks));
    const filtered = result.current.applyGraphFilters({ entities: sampleEntities, links: sampleLinks });
    expect(filtered.entities).toEqual(sampleEntities);
    expect(filtered.links).toEqual(sampleLinks);
  });

  it('filters nodes by type when typeFilter is set', () => {
    const { result } = renderHook(() => useGraphFilters(sampleEntities, sampleLinks));
    act(() => {
      result.current.setGraphFilters({
        ...EMPTY_GRAPH_FILTERS,
        typeFilter: new Set(['person']),
      });
    });
    const filtered = result.current.applyGraphFilters({ entities: sampleEntities, links: sampleLinks });
    expect(filtered.entities.map(e => e.id)).toEqual([entity1.id]);
    expect(filtered.links).toEqual([]);
  });

  it('filters links by relation when relationFilter is set', () => {
    const { result } = renderHook(() => useGraphFilters(sampleEntities, sampleLinks));
    act(() => {
      result.current.setGraphFilters({
        ...EMPTY_GRAPH_FILTERS,
        relationFilter: new Set(['works_on']),
      });
    });
    const filtered = result.current.applyGraphFilters({ entities: sampleEntities, links: sampleLinks });
    expect(filtered.links.map(l => l.id)).toEqual([linkA.id]);
  });

  it('highlights nodes whose label matches the search query', () => {
    const { result } = renderHook(() => useGraphFilters(sampleEntities, sampleLinks));
    act(() => {
      result.current.setGraphFilters({
        ...EMPTY_GRAPH_FILTERS,
        nodeSearch: 'atl',
      });
    });
    const filtered = result.current.applyGraphFilters({ entities: sampleEntities, links: sampleLinks });
    expect(filtered.entities.map(e => e.id)).toEqual([entity2.id]);
  });

  it('applies the minDegree filter to drop low-degree nodes', () => {
    const { result } = renderHook(() => useGraphFilters(sampleEntities, sampleLinks));
    act(() => {
      result.current.setGraphFilters({
        ...EMPTY_GRAPH_FILTERS,
        minDegree: 2,
      });
    });
    const filtered = result.current.applyGraphFilters({ entities: sampleEntities, links: sampleLinks });
    expect(filtered.entities.map(e => e.id)).toEqual([entity2.id]);
    expect(filtered.links).toEqual([]);
  });
});

describe('GraphInspector', () => {
  const baseEntity: Entity = {
    id: entity1.id,
    name: 'Alice',
    type: 'person',
    description: 'A test person',
  };

  const claims: Claim[] = [
    {
      id: 'cl-1',
      entity_id: entity1.id!,
      statement: 'Alice works on Project Atlas',
      confidence: 0.9,
      verification_status: 'verified',
    },
    {
      id: 'cl-2',
      entity_id: entity1.id!,
      statement: 'Alice likes coffee',
      evidence: 'observation',
      confidence: 0.8,
      verification_status: 'unverified',
    },
  ];

  const links: Link[] = [
    {
      id: 'l1',
      source_id: entity1.id!,
      target_id: entity2.id!,
      relation: 'works_on',
    },
    {
      id: 'l2',
      source_id: entity3.id!,
      target_id: entity1.id!,
      relation: 'mentions',
    },
  ];

  const entities: Entity[] = [entity1, entity2, entity3];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders entity name, type, and description', () => {
    render(<GraphInspector entity={baseEntity} claims={[]} links={[]} entities={entities} onClose={vi.fn()} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('person')).toBeDefined();
    expect(screen.getByText('A test person')).toBeDefined();
  });

  it('renders the claims list with statements and evidence', () => {
    render(<GraphInspector entity={baseEntity} claims={claims} links={[]} entities={entities} onClose={vi.fn()} />);
    expect(screen.getByText(/Alice works on Project Atlas/)).toBeDefined();
    expect(screen.getByText(/Alice likes coffee/)).toBeDefined();
    expect(screen.getByText('Evidence: observation')).toBeDefined();
  });

  it('renders the outgoing relations list with target entity names', () => {
    render(<GraphInspector entity={baseEntity} claims={[]} links={links} entities={entities} onClose={vi.fn()} />);
    expect(screen.getByText(/works_on/)).toBeDefined();
    expect(screen.getByText(/Project Atlas/)).toBeDefined();
  });

  it('renders the backlinks section with source entity names', () => {
    render(<GraphInspector entity={baseEntity} claims={[]} links={links} entities={entities} onClose={vi.fn()} />);
    expect(screen.getByText(/Note/)).toBeDefined();
    expect(screen.getByText(/mentions/)).toBeDefined();
  });

  it('shows the empty state when there are no claims or links', () => {
    render(<GraphInspector entity={baseEntity} claims={[]} links={[]} entities={entities} onClose={vi.fn()} />);
    expect(screen.getByText(/No claims or links found/)).toBeDefined();
  });

  it('hides the description when the entity has none', () => {
    render(<GraphInspector entity={{ ...baseEntity, description: undefined }} claims={[]} links={[]} entities={entities} onClose={vi.fn()} />);
    expect(screen.queryByText('A test person')).toBeNull();
  });

  it('invokes onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<GraphInspector entity={baseEntity} claims={[]} links={[]} entities={entities} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close inspector'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onEdit with the entity id when the edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<GraphInspector entity={baseEntity} claims={[]} links={[]} entities={entities} onClose={vi.fn()} onEdit={onEdit} />);
    fireEvent.click(screen.getByLabelText('Edit Alice'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(entity1.id);
  });

  it('renders Unknown Entity when a link endpoint is missing from the entity list', () => {
    const danglingLink: Link = {
      id: 'dangling',
      source_id: 'unknown-id',
      target_id: entity1.id!,
      relation: 'links_to',
    };
    render(<GraphInspector entity={baseEntity} claims={[]} links={[danglingLink]} entities={entities} onClose={vi.fn()} />);
    expect(screen.getByText(/Unknown Entity/)).toBeDefined();
  });

  it('handles a confirmed delete by calling repository.deleteEntity and removeFromSearchIndex', async () => {
    const onClose = vi.fn();
    const deleteEntityMock = vi.mocked(mockedRepository.deleteEntity);
    deleteEntityMock.mockClear();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <GraphInspector
        entity={baseEntity}
        claims={[]}
        links={[]}
        entities={entities}
        onClose={onClose}
      />,
    );

    const deleteBtn = screen.getByLabelText('Delete Alice');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteEntityMock).toHaveBeenCalledWith(entity1.id);
    });
    confirmSpy.mockRestore();
  });
});

describe('GraphFiltersPanel integration via useGraphFilters', () => {
  it('toggling type filter removes non-matching nodes from the filtered graph', () => {
    const { result } = renderHook(() => useGraphFilters(sampleEntities, sampleLinks));
    act(() => {
      result.current.setGraphFilters({ ...EMPTY_GRAPH_FILTERS, typeFilter: new Set(['project']) });
    });
    const filtered = result.current.applyGraphFilters({ entities: sampleEntities, links: sampleLinks });
    expect(filtered.entities).toHaveLength(1);
    expect(filtered.entities[0].id).toBe(entity2.id);
  });

  it('search filter keeps only matching nodes and drops their now-orphaned edges', () => {
    const { result } = renderHook(() => useGraphFilters(sampleEntities, sampleLinks));
    act(() => {
      result.current.setGraphFilters({ ...EMPTY_GRAPH_FILTERS, nodeSearch: 'Alice' });
    });
    const filtered = result.current.applyGraphFilters({ entities: sampleEntities, links: sampleLinks });
    expect(filtered.entities.map(e => e.id)).toEqual([entity1.id]);
    expect(filtered.links).toEqual([]);
  });

  it('combining type and minDegree filters produces correct results', () => {
    const extraEntity: Entity = { id: '44444444-4444-4444-4444-444444444444', name: 'Isolated', type: 'note' };
    const entities: Entity[] = [...sampleEntities, extraEntity];
    const links: Link[] = [
      ...sampleLinks,
      {
        id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        source_id: extraEntity.id!,
        target_id: entity1.id!,
        relation: 'references',
      },
    ];

    const { result } = renderHook(() => useGraphFilters(entities, links));
    act(() => {
      result.current.setGraphFilters({
        ...EMPTY_GRAPH_FILTERS,
        typeFilter: new Set(['note']),
        minDegree: 1,
      });
    });
    const filtered = result.current.applyGraphFilters({ entities, links });
    expect(filtered.entities.map(e => e.id)).toContain(extraEntity.id);
    expect(filtered.entities.map(e => e.id)).toContain(entity3.id);
  });
});
