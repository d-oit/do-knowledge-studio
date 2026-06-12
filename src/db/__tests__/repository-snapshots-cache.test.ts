import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Repository } from '../repository';
import { getDb } from '../client';
import { AppError } from '../../lib/errors';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_UUID = '660e8400-e29b-41d4-a716-446655440001';
const THIRD_UUID = '770e8400-e29b-41d4-a716-446655440002';

vi.mock('../client', () => ({
  getDb: vi.fn(),
  initDb: vi.fn(),
}));

vi.stubGlobal('crypto', {
  randomUUID: () => VALID_UUID,
});

function createMockExec(returnValue: unknown) {
  return vi.fn().mockResolvedValue(returnValue);
}

function createMockSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: THIRD_UUID,
    name: 'Test Snapshot',
    nodes_json: '[{"id":"n1","label":"Node 1"}]',
    edges_json: '[{"id":"e1","source":"n1","target":"n2"}]',
    description: 'A test snapshot',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Repository — Snapshots, Web Cache & Wrappers', () => {
  let repository: Repository;
  let mockExec: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExec = createMockExec([]);
    const mockTransaction = vi.fn().mockResolvedValue([]);
    const mockDb = { exec: mockExec, transaction: mockTransaction };
    (getDb as unknown as Mock<[], unknown>).mockReturnValue(mockDb);
    repository = new Repository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSnapshot', () => {
    it('should create a graph snapshot', async () => {
      const mockSnapshot = createMockSnapshot();
      mockExec.mockResolvedValue([mockSnapshot]);

      const nodes = [{ id: 'n1', label: 'Node 1' }];
      const edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

      const result = await repository.createSnapshot('Test Snapshot', nodes, edges, 'A test snapshot');

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INSERT INTO graph_snapshots'),
        bind: ['Test Snapshot', JSON.stringify(nodes), JSON.stringify(edges), 'A test snapshot'],
      }));
      expect(result.name).toBe('Test Snapshot');
    });
  });

  describe('getSnapshot', () => {
    it('should return a snapshot by id', async () => {
      const mockSnapshot = createMockSnapshot();
      mockExec.mockResolvedValue([mockSnapshot]);

      const result = await repository.getSnapshot(THIRD_UUID);

      expect(result?.name).toBe('Test Snapshot');
    });

    it('should return null when snapshot not found', async () => {
      mockExec.mockResolvedValue([]);
      const result = await repository.getSnapshot(THIRD_UUID);
      expect(result).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    it('should return all snapshots ordered by date', async () => {
      const mockSnapshots = [createMockSnapshot(), createMockSnapshot({ id: OTHER_UUID, name: 'Older' })];
      mockExec.mockResolvedValue(mockSnapshots);

      const result = await repository.listSnapshots();

      expect(result).toHaveLength(2);
      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('ORDER BY created_at DESC'),
      }));
    });
  });

  describe('diffSnapshots', () => {
    it('should compute diff between two snapshots', async () => {
      const snap1 = createMockSnapshot({
        id: VALID_UUID,
        nodes_json: '[{"id":"n1"},{"id":"n2"}]',
        edges_json: '[{"id":"e1"}]',
      });
      const snap2 = createMockSnapshot({
        id: OTHER_UUID,
        nodes_json: '[{"id":"n1"},{"id":"n3"}]',
        edges_json: '[{"id":"e2"}]',
      });

      mockExec
        .mockResolvedValueOnce([snap1])
        .mockResolvedValueOnce([snap2]);

      const diff = await repository.diffSnapshots(VALID_UUID, OTHER_UUID);

      expect(diff.added_nodes).toEqual(['n3']);
      expect(diff.removed_nodes).toEqual(['n2']);
      expect(diff.added_edges).toEqual(['e2']);
      expect(diff.removed_edges).toEqual(['e1']);
    });

    it('should throw AppError when snapshot not found', async () => {
      mockExec.mockResolvedValue([]);

      await expect(
        repository.diffSnapshots(VALID_UUID, OTHER_UUID)
      ).rejects.toThrow(AppError);
    });
  });

  describe('upsertWebCache', () => {
    it('should insert new web cache entry', async () => {
      mockExec.mockResolvedValue([]);

      await repository.upsertWebCache('https://example.com', 'Sample content', 'Example', 'markdown');

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INSERT OR REPLACE INTO web_cache'),
        bind: ['https://example.com', 'Sample content', 'markdown', 'Example'],
      }));
    });

    it('should replace existing web cache entry', async () => {
      mockExec.mockResolvedValue([]);

      await repository.upsertWebCache('https://example.com', 'Updated content', null, 'plain');

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INSERT OR REPLACE INTO web_cache'),
        bind: ['https://example.com', 'Updated content', 'plain', null],
      }));
    });

    it('should default format to plain when omitted', async () => {
      mockExec.mockResolvedValue([]);

      await repository.upsertWebCache('https://test.com', 'content');

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        bind: ['https://test.com', 'content', 'plain', null],
      }));
    });
  });

  describe('getWebCache', () => {
    it('should return cached content by URL', async () => {
      mockExec.mockResolvedValue([{
        url: 'https://example.com',
        content: 'Cached content',
        format: 'markdown',
        title: 'Example Title',
        resolved_at: '2024-01-01T00:00:00.000Z',
      }]);

      const result = await repository.getWebCache('https://example.com');

      expect(result).not.toBeNull();
      expect(result!.url).toBe('https://example.com');
      expect(result!.content).toBe('Cached content');
      expect(result!.format).toBe('markdown');
      expect(result!.title).toBe('Example Title');
    });

    it('should return null when URL not cached', async () => {
      mockExec.mockResolvedValue([]);

      const result = await repository.getWebCache('https://uncached.com');

      expect(result).toBeNull();
    });

    it('should handle missing title field', async () => {
      mockExec.mockResolvedValue([{
        url: 'https://example.com',
        content: 'No title content',
        format: 'plain',
        title: null,
        resolved_at: '2024-01-01T00:00:00.000Z',
      }]);

      const result = await repository.getWebCache('https://example.com');

      expect(result).not.toBeNull();
      expect(result!.title).toBeUndefined();
    });
  });
});
