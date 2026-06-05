import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { z } from 'zod';
import { Repository } from '../repository';
import { getDb } from '../client';
import { AppError } from '../../lib/errors';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_UUID = '660e8400-e29b-41d4-a716-446655440001';
const THIRD_UUID = '770e8400-e29b-41d4-a716-446655440002';

// Mock the client module
vi.mock('../client', () => ({
  getDb: vi.fn(),
  initDb: vi.fn(),
}));

// Mock crypto.randomUUID for happy-dom environment
vi.stubGlobal('crypto', {
  randomUUID: () => VALID_UUID,
});

// Helper to create mock DB exec function
function createMockExec(returnValue: unknown) {
  return vi.fn().mockResolvedValue(returnValue);
}

// Helper to create mock entity
function createMockEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    name: 'Test Entity',
    type: 'person',
    description: 'A test entity',
    metadata: '{}',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to create mock claim
function createMockClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: OTHER_UUID,
    entity_id: VALID_UUID,
    statement: 'Test claim statement',
    evidence: 'Test evidence',
    confidence: 0.9,
    source: 'Test source',
    verification_status: 'unverified',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to create mock note
function createMockNote(overrides: Record<string, unknown> = {}) {
  return {
    id: THIRD_UUID,
    entity_id: VALID_UUID,
    content: 'Test note content',
    format: 'markdown',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to create mock link
function createMockLink(overrides: Record<string, unknown> = {}) {
  return {
    id: THIRD_UUID,
    source_id: VALID_UUID,
    target_id: OTHER_UUID,
    relation: 'related_to',
    metadata: '{}',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to create mock snapshot
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

describe('Repository', () => {
  let repository: Repository;
  let mockExec: ReturnType<typeof vi.fn>;
  let mockTransaction: ReturnType<typeof vi.fn>;
  let mockDb: { exec: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockExec = createMockExec([]);
    mockTransaction = vi.fn().mockResolvedValue([]);
    mockDb = { exec: mockExec, transaction: mockTransaction };
    (getDb as unknown as Mock<[], unknown>).mockReturnValue(mockDb);
    repository = new Repository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createEntity', () => {
    it('should create an entity with all fields', async () => {
      const mockEntity = createMockEntity({ metadata: '{"key":"value"}' });
      mockExec.mockResolvedValue([mockEntity]);

      const result = await repository.createEntity({
        name: 'Test Entity',
        type: 'person',
        description: 'A test entity',
        metadata: { key: 'value' },
      });

      expect(mockExec).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO entities'),
        bind: ['Test Entity', 'person', 'A test entity', '{"key":"value"}'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toEqual(expect.objectContaining({ name: 'Test Entity' }));
    });

    it('should create an entity without optional fields', async () => {
      const mockEntity = createMockEntity({ description: null, metadata: null });
      mockExec.mockResolvedValue([mockEntity]);

      const result = await repository.createEntity({
        name: 'Test Entity',
        type: 'person',
      });

      expect(mockExec).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO entities'),
        bind: ['Test Entity', 'person', null, null],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toBeDefined();
    });

    it('should throw AppError on database failure', async () => {
      mockExec.mockRejectedValue(new Error('DB error'));

      await expect(
        repository.createEntity({
          name: 'Test Entity',
          type: 'person',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('getAllEntities', () => {
    it('should return all entities ordered by name', async () => {
      const mockEntities = [
        createMockEntity({ name: 'Alice', id: VALID_UUID }),
        createMockEntity({ name: 'Bob', id: OTHER_UUID }),
      ];
      mockExec.mockResolvedValue(mockEntities);

      const result = await repository.getAllEntities();

      expect(mockExec).toHaveBeenCalledWith({
        sql: 'SELECT * FROM entities ORDER BY name ASC',
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toHaveLength(2);
    });

    it('should get an entity by id', async () => {
      const mockEntity = createMockEntity({ id: VALID_UUID });
      mockExec.mockResolvedValue([mockEntity]);

      const result = await repository.getEntityById(VALID_UUID);

      expect(mockExec).toHaveBeenCalledWith({
        sql: 'SELECT *, rowid FROM entities WHERE id = ?',
        bind: [VALID_UUID],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result?.id).toBe(VALID_UUID);
    });

    it('should return null if entity not found by id', async () => {
      mockExec.mockResolvedValue([]);
      const result = await repository.getEntityById(VALID_UUID);
      expect(result).toBeNull();
    });

    it('should update an entity', async () => {
      const mockEntity = createMockEntity({ id: VALID_UUID, name: 'Old Name' });
      const updatedEntity = createMockEntity({ id: VALID_UUID, name: 'New Name' });
      
      mockExec.mockResolvedValueOnce([mockEntity]); // for getEntityById
      mockExec.mockResolvedValueOnce([updatedEntity]); // for update

      const result = await repository.updateEntity(VALID_UUID, { name: 'New Name' });

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('UPDATE entities SET name = ?'),
        bind: expect.arrayContaining(['New Name', VALID_UUID]),
      }));
      expect(result.name).toBe('New Name');
    });

    it('should delete an entity', async () => {
      mockExec.mockResolvedValue([]);
      await repository.deleteEntity(VALID_UUID);
      expect(mockExec).toHaveBeenCalledWith({
        sql: 'DELETE FROM entities WHERE id = ?',
        bind: [VALID_UUID],
      });
    });

    it('should parse metadata for each entity', async () => {
      const mockEntities = [
        createMockEntity({ id: VALID_UUID, metadata: '{"type":"test"}' }),
        createMockEntity({ id: OTHER_UUID, metadata: null }),
      ];
      mockExec.mockResolvedValue(mockEntities);

      const result = await repository.getAllEntities();

      expect(result[0].metadata).toEqual({ type: 'test' });
      expect(result[1].metadata).toEqual({});
    });
  });

  describe('updateClaim', () => {
    it('should update a claim', async () => {
      const mockClaim = createMockClaim({ id: OTHER_UUID, statement: 'Old statement' });
      const updatedClaim = createMockClaim({ id: OTHER_UUID, statement: 'New statement' });

      mockExec.mockResolvedValueOnce([mockClaim]); // for initial check
      mockExec.mockResolvedValueOnce([updatedClaim]); // for update

      const result = await repository.updateClaim(OTHER_UUID, { statement: 'New statement' });

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('UPDATE claims SET statement = ?'),
        bind: expect.arrayContaining(['New statement', OTHER_UUID]),
      }));
      expect(result.statement).toBe('New statement');
    });
  });

  describe('updateNote', () => {
    it('should update a note', async () => {
      const mockNote = {
        id: THIRD_UUID,
        entity_id: VALID_UUID,
        content: 'Old content',
        format: 'markdown',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };
      const updatedNote = { ...mockNote, content: 'New content' };

      mockExec.mockResolvedValueOnce([mockNote]); // for initial check
      mockExec.mockResolvedValueOnce([updatedNote]); // for update

      const result = await repository.updateNote(THIRD_UUID, { content: 'New content' });

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('UPDATE notes SET content = ?'),
        bind: expect.arrayContaining(['New content', 'markdown', THIRD_UUID]),
      }));
      expect(result.content).toBe('New content');
    });
  });

  describe('createNote', () => {
    it('should create a note with null entity_id', async () => {
      const mockNote = {
        id: THIRD_UUID,
        entity_id: null,
        content: 'Test note',
        format: 'plain',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };
      mockExec.mockResolvedValue([mockNote]);

      const result = await repository.createNote({
        content: 'Test note',
        format: 'plain',
      });

      expect(mockExec).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO notes'),
        bind: [null, 'Test note', 'plain'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toBeDefined();
    });
  });

  // --- Entity search & lookup ---
  describe('searchEntities', () => {
    it('should search entities via FTS5', async () => {
      const mockEntity = createMockEntity({ name: 'Searched Entity' });
      mockExec.mockResolvedValue([mockEntity]);

      const result = await repository.searchEntities('searched');

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('entity_search_idx'),
        bind: ['searched*'],
      }));
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Searched Entity');
    });

    it('should fallback to LIKE when FTS5 returns empty', async () => {
      const mockEntity = createMockEntity({ name: 'Fallback Entity' });
      mockExec
        .mockResolvedValueOnce([]) // FTS5 returns nothing
        .mockResolvedValueOnce([mockEntity]); // LIKE fallback

      const result = await repository.searchEntities('fallback');

      expect(mockExec).toHaveBeenCalledTimes(2);
      expect(mockExec).toHaveBeenLastCalledWith(expect.objectContaining({
        sql: expect.stringContaining('LIKE'),
        bind: ['%fallback%', '%fallback%'],
      }));
      expect(result).toHaveLength(1);
    });
  });

  describe('getEntityByName', () => {
    it('should find entity by name', async () => {
      const mockEntity = createMockEntity({ name: 'Unique Name' });
      mockExec.mockResolvedValue([mockEntity]);

      const result = await repository.getEntityByName('Unique Name');

      expect(result?.name).toBe('Unique Name');
    });

    it('should return null when entity name not found', async () => {
      mockExec.mockResolvedValue([]);
      const result = await repository.getEntityByName('Nonexistent');
      expect(result).toBeNull();
    });
  });

  // --- Claims CRUD ---
  describe('createClaim', () => {
    it('should create a claim with all fields', async () => {
      const mockClaim = createMockClaim();
      mockExec.mockResolvedValue([mockClaim]);

      const result = await repository.createClaim({
        entity_id: VALID_UUID,
        statement: 'Test claim statement',
        evidence: 'Test evidence',
        confidence: 0.9,
        source: 'Test source',
        verification_status: 'unverified',
      });

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INSERT INTO claims'),
        bind: [VALID_UUID, 'Test claim statement', 'Test evidence', 0.9, 'Test source', 'unverified'],
      }));
      expect(result.statement).toBe('Test claim statement');
    });
  });

  describe('getAllClaims', () => {
    it('should return all claims', async () => {
      const mockClaims = [createMockClaim(), createMockClaim({ id: THIRD_UUID })];
      mockExec.mockResolvedValue(mockClaims);

      const result = await repository.getAllClaims();

      expect(result).toHaveLength(2);
      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: 'SELECT * FROM claims',
      }));
    });
  });

  describe('getClaimsByEntityId', () => {
    it('should return claims for an entity', async () => {
      const mockClaims = [createMockClaim(), createMockClaim({ id: THIRD_UUID })];
      mockExec.mockResolvedValue(mockClaims);

      const result = await repository.getClaimsByEntityId(VALID_UUID);

      expect(result).toHaveLength(2);
      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('WHERE entity_id = ?'),
        bind: [VALID_UUID],
      }));
    });

    it('should return empty array when no claims found', async () => {
      mockExec.mockResolvedValue([]);
      const result = await repository.getClaimsByEntityId(VALID_UUID);
      expect(result).toHaveLength(0);
    });
  });

  describe('deleteClaim', () => {
    it('should delete a claim', async () => {
      mockExec.mockResolvedValue([]);
      await repository.deleteClaim(OTHER_UUID);

      expect(mockExec).toHaveBeenCalledWith({
        sql: 'DELETE FROM claims WHERE id = ?',
        bind: [OTHER_UUID],
      });
    });
  });

  describe('getClaimsByVerificationStatus', () => {
    it('should return claims by verification status', async () => {
      const mockClaims = [createMockClaim({ verification_status: 'verified' })];
      mockExec.mockResolvedValue(mockClaims);

      const result = await repository.getClaimsByVerificationStatus('verified');

      expect(result).toHaveLength(1);
      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        bind: ['verified'],
      }));
    });
  });

  describe('updateClaimVerification', () => {
    it('should update claim verification status', async () => {
      const updatedClaim = createMockClaim({ verification_status: 'verified' });
      mockExec.mockResolvedValue([updatedClaim]);

      const result = await repository.updateClaimVerification(OTHER_UUID, 'verified');

      expect(result.verification_status).toBe('verified');
      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        bind: ['verified', OTHER_UUID],
      }));
    });

    it('should throw AppError when claim not found', async () => {
      mockExec.mockResolvedValue([]);

      await expect(
        repository.updateClaimVerification(OTHER_UUID, 'verified')
      ).rejects.toThrow(AppError);
    });
  });

  // --- Notes CRUD ---
  describe('getNotesByEntityId', () => {
    it('should return notes for an entity', async () => {
      const mockNotes = [createMockNote(), createMockNote({ id: OTHER_UUID })];
      mockExec.mockResolvedValue(mockNotes);

      const result = await repository.getNotesByEntityId(VALID_UUID);

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteNote', () => {
    it('should delete a note', async () => {
      mockExec.mockResolvedValue([]);
      await repository.deleteNote(THIRD_UUID);

      expect(mockExec).toHaveBeenCalledWith({
        sql: 'DELETE FROM notes WHERE id = ?',
        bind: [THIRD_UUID],
      });
    });
  });

  // --- Links CRUD ---
  describe('createLink', () => {
    it('should create a link with all fields', async () => {
      const mockLink = createMockLink();
      mockExec.mockResolvedValue([mockLink]);

      const result = await repository.createLink({
        source_id: VALID_UUID,
        target_id: OTHER_UUID,
        relation: 'related_to',
        metadata: {},
      });

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INSERT INTO links'),
        bind: [VALID_UUID, OTHER_UUID, 'related_to', '{}'],
      }));
      expect(result.relation).toBe('related_to');
    });
  });

  describe('getAllLinks', () => {
    it('should return all links', async () => {
      const mockLinks = [createMockLink(), createMockLink({ id: OTHER_UUID })];
      mockExec.mockResolvedValue(mockLinks);

      const result = await repository.getAllLinks();

      expect(result).toHaveLength(2);
      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: 'SELECT * FROM links',
      }));
    });
  });

  describe('deleteLink', () => {
    it('should delete a link', async () => {
      mockExec.mockResolvedValue([]);
      await repository.deleteLink(THIRD_UUID);

      expect(mockExec).toHaveBeenCalledWith({
        sql: 'DELETE FROM links WHERE id = ?',
        bind: [THIRD_UUID],
      });
    });
  });

  describe('getBacklinks', () => {
    it('should return source entities linking to the target', async () => {
      const mockEntities = [createMockEntity({ name: 'Source Entity', id: OTHER_UUID })];
      mockExec.mockResolvedValue(mockEntities);

      const result = await repository.getBacklinks(VALID_UUID);

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('JOIN links l ON e.id = l.source_id'),
        bind: [VALID_UUID],
      }));
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Source Entity');
    });
  });

  describe('getBacklinkCount', () => {
    it('should return the count of backlinks', async () => {
      mockExec.mockResolvedValue([{ count: 5 }]);

      const result = await repository.getBacklinkCount(VALID_UUID);

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: 'SELECT COUNT(DISTINCT source_id) as count FROM links WHERE target_id = ?',
        bind: [VALID_UUID],
      }));
      expect(result).toBe(5);
    });

    it('should return 0 when no backlinks found', async () => {
      mockExec.mockResolvedValue([]);
      const result = await repository.getBacklinkCount(VALID_UUID);
      expect(result).toBe(0);
    });
  });

  // --- Snapshots CRUD ---
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
      // Note: mockResolvedValueOnce chains by call order. Promise.all fires both
      // getSnapshot calls concurrently, but the mock resolves in call order.
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

  // --- Web Cache ---
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

  // --- RepositoryBase helpers ---
  describe('parseMetadata / normalizeFields', () => {
    it('should parse JSON string metadata', () => {
      const row = { metadata: '{"key":"value"}', description: 'test' };
      const result = repository.parseMetadata(
        z.object({ metadata: z.record(z.string()).default({}), description: z.string().optional() }),
        row
      );
      expect(result.metadata).toEqual({ key: 'value' });
      expect(result.description).toBe('test');
    });

    it('should default metadata to {} when null', () => {
      const row = { metadata: null };
      const result = repository.parseMetadata(
        z.object({ metadata: z.record(z.unknown()).default({}) }),
        row
      );
      expect(result.metadata).toEqual({});
    });

    it('should default metadata to {} when invalid JSON string', () => {
      const row = { metadata: 'not-json{' };
      const result = repository.parseMetadata(
        z.object({ metadata: z.record(z.unknown()).default({}) }),
        row
      );
      expect(result.metadata).toEqual({});
    });

    it('should normalize null description to undefined', () => {
      const row = { description: null, metadata: {} };
      const result = repository.parseMetadata(
        z.object({ description: z.string().optional(), metadata: z.record(z.unknown()).default({}) }),
        row
      );
      expect(result.description).toBeUndefined();
    });

    it('should normalize null evidence to undefined', () => {
      const row = { evidence: null, metadata: {} };
      const result = repository.parseMetadata(
        z.object({ evidence: z.string().optional(), metadata: z.record(z.unknown()).default({}) }),
        row
      );
      expect(result.evidence).toBeUndefined();
    });

    it('should normalize null source to undefined', () => {
      const row = { source: null, metadata: {} };
      const result = repository.parseMetadata(
        z.object({ source: z.string().optional(), metadata: z.record(z.unknown()).default({}) }),
        row
      );
      expect(result.source).toBeUndefined();
    });

    it('should handle all-null optional fields', () => {
      const row = { description: null, evidence: null, source: null, metadata: null };
      const result = repository.parseMetadata(
        z.object({
          description: z.string().optional(),
          evidence: z.string().optional(),
          source: z.string().optional(),
          metadata: z.record(z.unknown()).default({}),
        }),
        row
      );
      expect(result.description).toBeUndefined();
      expect(result.evidence).toBeUndefined();
      expect(result.source).toBeUndefined();
      expect(result.metadata).toEqual({});
    });

    it('should preserve existing object metadata as-is', () => {
      const existingMetadata = { key: 'value', nested: { a: 1 } };
      const row = { metadata: existingMetadata, description: 'test' };
      const result = repository.parseMetadata(
        z.object({ metadata: z.record(z.unknown()).default({}), description: z.string().optional() }),
        row
      );
      expect(result.metadata).toEqual({ key: 'value', nested: { a: 1 } });
    });

    it('should not mutate the original row object', () => {
      const row = { metadata: null, description: null };
      const copy = { ...row };
      repository.parseMetadata(
        z.object({ metadata: z.record(z.unknown()).default({}), description: z.string().optional() }),
        row
      );
      expect(row).toEqual(copy);
    });
  });

  // --- Wrapper methods ---
  describe('exec', () => {
    it('should delegate to db.exec', async () => {
      mockExec.mockResolvedValue([{ id: 1 }]);
      const result = await repository.exec({ sql: 'SELECT 1' });

      expect(mockExec).toHaveBeenCalledWith({ sql: 'SELECT 1' });
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('transaction', () => {
    it('should delegate to db.transaction', async () => {
      mockTransaction.mockResolvedValue([{ result: 'ok' }]);
      const statements = [{ sql: 'INSERT INTO test VALUES (1)' }];
      const result = await repository.transaction(statements);

      expect(mockTransaction).toHaveBeenCalledWith(statements);
      expect(result).toEqual([{ result: 'ok' }]);
    });
  });
});
