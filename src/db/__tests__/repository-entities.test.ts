import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { z } from 'zod';
import { Repository } from '../repository';
import { getDb } from '../client';
import { AppError } from '../../lib/errors';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_UUID = '660e8400-e29b-41d4-a716-446655440001';

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

function createMockNote(overrides: Record<string, unknown> = {}) {
  return {
    id: '770e8400-e29b-41d4-a716-446655440002',
    entity_id: VALID_UUID,
    content: 'Test note content',
    format: 'markdown',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Repository — Entities & Search', () => {
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
        bind: ['Test Entity', 'person', 'A test entity', null, '{"key":"value"}'],
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
        bind: ['Test Entity', 'person', null, null, null],
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

      mockExec.mockResolvedValueOnce([mockEntity]);
      mockExec.mockResolvedValueOnce([updatedEntity]);

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
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockEntity]);

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

  describe('createNote', () => {
    it('should create a note with null entity_id', async () => {
      const mockNote = {
        id: '770e8400-e29b-41d4-a716-446655440002',
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

  describe('updateNote', () => {
    it('should update a note', async () => {
      const mockNote = {
        id: '770e8400-e29b-41d4-a716-446655440002',
        entity_id: VALID_UUID,
        content: 'Old content',
        format: 'markdown',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };
      const updatedNote = { ...mockNote, content: 'New content' };

      mockExec.mockResolvedValueOnce([mockNote]);
      mockExec.mockResolvedValueOnce([updatedNote]);

      const result = await repository.updateNote('770e8400-e29b-41d4-a716-446655440002', { content: 'New content' });

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('UPDATE notes SET content = ?'),
        bind: expect.arrayContaining(['New content', 'markdown', '770e8400-e29b-41d4-a716-446655440002']),
      }));
      expect(result.content).toBe('New content');
    });
  });

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
      await repository.deleteNote('770e8400-e29b-41d4-a716-446655440002');

      expect(mockExec).toHaveBeenCalledWith({
        sql: 'DELETE FROM notes WHERE id = ?',
        bind: ['770e8400-e29b-41d4-a716-446655440002'],
      });
    });
  });

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
      const mockTransaction = vi.fn().mockResolvedValue([{ result: 'ok' }]);
      const mockDb = { exec: mockExec, transaction: mockTransaction };
      const { getDb } = await import('../client');
      (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
      const repo = new Repository();
      const statements = [{ sql: 'INSERT INTO test VALUES (1)' }];
      const result = await repo.transaction(statements);

      expect(mockTransaction).toHaveBeenCalledWith(statements);
      expect(result).toEqual([{ result: 'ok' }]);
    });
  });
});
