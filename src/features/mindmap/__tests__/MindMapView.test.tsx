import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { render } from '../../../test/test-utils';
import MindMapView from '../MindMapView';
import type { Entity, Link } from '../../../lib/validation';

const VALID_PARENT_UUID = '11111111-1111-4111-8111-111111111111';
const VALID_CHILD_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_GRANDCHILD_UUID = '33333333-3333-4333-8333-333333333333';

interface MindElixirInstanceMock {
  bus: {
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };
  init: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  findEle: ReturnType<typeof vi.fn>;
  addChild: ReturnType<typeof vi.fn>;
  insertSibling: ReturnType<typeof vi.fn>;
  beginEdit: ReturnType<typeof vi.fn>;
  removeNodes: ReturnType<typeof vi.fn>;
  exportPng: ReturnType<typeof vi.fn>;
  updateNodeStyle: ReturnType<typeof vi.fn>;
}

const { instances, mockRepository, mockUpsertToSearchIndex, mockConsumeEvents, mockGraphSyncState, mockUseGraphSyncStore } = vi.hoisted(() => {
  const instances: MindElixirInstanceMock[] = [];
  const mockRepository = {
    createEntity: vi.fn(),
    createLink: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
  };
  const mockUpsertToSearchIndex = vi.fn();
  const mockConsumeEvents = vi.fn().mockReturnValue([]);
  const mockSetSyncEnabled = vi.fn();
  const mockGraphSyncState = {
    syncEnabled: false,
    pendingEvents: [] as unknown[],
    consumeEvents: mockConsumeEvents,
    clearEvents: vi.fn(),
    setSyncEnabled: mockSetSyncEnabled,
    emitEvent: vi.fn(),
  };
  const mockSubscribe = vi.fn().mockReturnValue(() => undefined);
  const mockUseGraphSyncStore = Object.assign(
    () => ({
      syncEnabled: mockGraphSyncState.syncEnabled,
      setSyncEnabled: mockSetSyncEnabled,
    }),
    {
      getState: () => mockGraphSyncState,
      subscribe: mockSubscribe,
    },
  );
  return {
    instances,
    mockRepository,
    mockUpsertToSearchIndex,
    mockConsumeEvents,
    mockGraphSyncState,
    mockSetSyncEnabled,
    mockUseGraphSyncStore,
  };
});

vi.mock('mind-elixir', () => {
  const MindElixirMock = vi.fn().mockImplementation(function MindElixirCtor() {
    const inst: MindElixirInstanceMock = {
      bus: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      init: vi.fn(),
      refresh: vi.fn(),
      findEle: vi.fn().mockReturnValue({ nodeObj: { id: 'topic-id' } }),
      addChild: vi.fn(),
      insertSibling: vi.fn(),
      beginEdit: vi.fn(),
      removeNodes: vi.fn(),
      exportPng: vi.fn(),
      updateNodeStyle: vi.fn(),
    };
    instances.push(inst);
    return inst;
  });
  return { default: MindElixirMock };
});

vi.mock('../../../db/repository', () => ({
  repository: mockRepository,
}));

vi.mock('../../../lib/search', () => ({
  upsertToSearchIndex: mockUpsertToSearchIndex,
}));

vi.mock('../../../store/graph-sync-store', () => ({
  useGraphSyncStore: mockUseGraphSyncStore,
}));

vi.mock('../../../lib/perf', () => ({
  perf: {
    mark: vi.fn(),
    measure: vi.fn(),
  },
}));

vi.mock('../sync-adapter', () => ({
  setupMindMapSyncListeners: vi.fn(),
}));

const createEntity = (id: string, name: string): Entity => ({
  id,
  name,
  type: 'concept',
  description: '',
  content: '',
  created_at: '',
  updated_at: '',
});

const baseRoot: Entity = createEntity(VALID_PARENT_UUID, 'Root');
const baseRelated: Entity[] = [createEntity(VALID_CHILD_UUID, 'Child')];
const baseEntities: Entity[] = [baseRoot, ...baseRelated];
const baseLinks: Link[] = [];

async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function getOperationListener(): (op: Record<string, unknown>) => void {
  const instance = instances[instances.length - 1];
  if (!instance) throw new Error('MindElixir instance not constructed');
  const opCall = instance.bus.addListener.mock.calls.find(
    (c: unknown[]) => c[0] === 'operation',
  );
  if (!opCall) throw new Error('operation listener not registered');
  return opCall[1] as (op: Record<string, unknown>) => void;
}

beforeEach(() => {
  vi.clearAllMocks();
  instances.length = 0;
  mockRepository.createEntity.mockResolvedValue(
    createEntity(VALID_CHILD_UUID, 'New Child'),
  );
  mockRepository.createLink.mockResolvedValue({ id: 'link-1' });
  mockRepository.updateEntity.mockResolvedValue(
    createEntity(VALID_CHILD_UUID, 'Renamed'),
  );
  mockRepository.deleteEntity.mockResolvedValue(undefined);
  mockUpsertToSearchIndex.mockResolvedValue(undefined);
  mockConsumeEvents.mockReturnValue([]);
  mockGraphSyncState.syncEnabled = false;
  mockGraphSyncState.pendingEvents = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MindMapView', () => {
  it('renders the mind map shell with toolbar buttons', async () => {
    const { container } = render(
      <MindMapView
        rootEntity={baseRoot}
        relatedEntities={baseRelated}
        entities={baseEntities}
        links={baseLinks}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector('.viz-toolbar')).not.toBeNull();
    });
    expect(container.querySelector('[aria-label="Add child node"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Rename selected node"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Delete selected node"]')).not.toBeNull();
  });

  describe('addChild operation handler', () => {
    it('creates a new entity and links it to the parent', async () => {
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({
        name: 'addChild',
        obj: { id: 'mind-node-1', topic: 'New Idea', parent: { id: VALID_PARENT_UUID } },
      });
      await flushAsync();
      expect(mockRepository.createEntity).toHaveBeenCalledWith({
        name: 'New Idea',
        type: 'note',
        description: '',
        metadata: {},
      });
      expect(mockRepository.createLink).toHaveBeenCalledWith({
        source_id: VALID_PARENT_UUID,
        target_id: VALID_CHILD_UUID,
        relation: 'hierarchy',
      });
    });

    it('falls back to rootId when parent id is not a valid UUID', async () => {
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({
        name: 'addChild',
        obj: { id: 'mind-node-2', topic: 'Child of Root', parent: { id: 'not-a-uuid' } },
      });
      await flushAsync();
      expect(mockRepository.createEntity).toHaveBeenCalled();
      expect(mockRepository.createLink).toHaveBeenCalledWith({
        source_id: VALID_PARENT_UUID,
        target_id: VALID_CHILD_UUID,
        relation: 'hierarchy',
      });
    });

    it('ignores addChild events with no topic', async () => {
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({ name: 'addChild', obj: { id: 'x' } });
      await flushAsync();
      expect(mockRepository.createEntity).not.toHaveBeenCalled();
      expect(mockRepository.createLink).not.toHaveBeenCalled();
    });

    it('logs an error when entity creation fails', async () => {
      mockRepository.createEntity.mockRejectedValueOnce(new Error('boom'));
      const { logger } = await import('../../../lib/logger');
      const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({
        name: 'addChild',
        obj: { id: 'mind-node-3', topic: 'Broken', parent: { id: VALID_PARENT_UUID } },
      });
      await flushAsync();
      expect(errSpy).toHaveBeenCalled();
      expect(mockRepository.createLink).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  describe('finishEdit operation handler', () => {
    it('updates the entity name for a valid UUID node', async () => {
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({
        name: 'finishEdit',
        obj: { id: VALID_CHILD_UUID, topic: 'Renamed Child' },
      });
      await flushAsync();
      expect(mockRepository.updateEntity).toHaveBeenCalledWith(VALID_CHILD_UUID, {
        name: 'Renamed Child',
      });
      expect(mockUpsertToSearchIndex).toHaveBeenCalledWith(VALID_CHILD_UUID);
    });

    it('ignores non-UUID node ids', async () => {
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({
        name: 'finishEdit',
        obj: { id: 'not-a-uuid', topic: 'Whatever' },
      });
      await flushAsync();
      expect(mockRepository.updateEntity).not.toHaveBeenCalled();
    });

    it('ignores events missing id or topic', async () => {
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({ name: 'finishEdit', obj: { id: VALID_CHILD_UUID } });
      handler({ name: 'finishEdit', obj: { topic: 'No id' } });
      await flushAsync();
      expect(mockRepository.updateEntity).not.toHaveBeenCalled();
    });

    it('logs an error when update fails', async () => {
      mockRepository.updateEntity.mockRejectedValueOnce(new Error('update failed'));
      const { logger } = await import('../../../lib/logger');
      const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({
        name: 'finishEdit',
        obj: { id: VALID_CHILD_UUID, topic: 'Try Rename' },
      });
      await flushAsync();
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  describe('removeNodes operation handler', () => {
    it('removes the entity for each provided UUID', async () => {
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({
        name: 'removeNodes',
        objs: [{ id: VALID_CHILD_UUID }, { id: VALID_GRANDCHILD_UUID }],
      });
      await flushAsync();
      expect(mockRepository.deleteEntity).toHaveBeenCalledTimes(2);
      expect(mockRepository.deleteEntity).toHaveBeenCalledWith(VALID_CHILD_UUID);
      expect(mockRepository.deleteEntity).toHaveBeenCalledWith(VALID_GRANDCHILD_UUID);
    });

    it('skips non-UUID ids in the objs array', async () => {
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({
        name: 'removeNodes',
        objs: [{ id: 'fake-1' }, { id: VALID_CHILD_UUID }, { id: null }],
      });
      await flushAsync();
      expect(mockRepository.deleteEntity).toHaveBeenCalledTimes(1);
      expect(mockRepository.deleteEntity).toHaveBeenCalledWith(VALID_CHILD_UUID);
    });

    it('ignores events without an objs array', async () => {
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({ name: 'removeNodes' });
      handler({ name: 'removeNodes', objs: 'not-an-array' });
      await flushAsync();
      expect(mockRepository.deleteEntity).not.toHaveBeenCalled();
    });

    it('logs an error when delete fails', async () => {
      mockRepository.deleteEntity.mockRejectedValueOnce(new Error('delete failed'));
      const { logger } = await import('../../../lib/logger');
      const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      render(
        <MindMapView
          rootEntity={baseRoot}
          relatedEntities={baseRelated}
          entities={baseEntities}
          links={baseLinks}
        />,
      );
      await waitFor(() => {
        expect(instances.length).toBeGreaterThan(0);
      });
      const handler = getOperationListener();
      handler({
        name: 'removeNodes',
        objs: [{ id: VALID_CHILD_UUID }],
      });
      await flushAsync();
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  it('ignores unknown operation names', async () => {
    render(
      <MindMapView
        rootEntity={baseRoot}
        relatedEntities={baseRelated}
        entities={baseEntities}
        links={baseLinks}
      />,
    );
    await waitFor(() => {
      expect(instances.length).toBeGreaterThan(0);
    });
    const handler = getOperationListener();
    handler({ name: 'somethingElse', obj: { id: VALID_CHILD_UUID } });
    await flushAsync();
    expect(mockRepository.createEntity).not.toHaveBeenCalled();
    expect(mockRepository.updateEntity).not.toHaveBeenCalled();
    expect(mockRepository.deleteEntity).not.toHaveBeenCalled();
  });
});
