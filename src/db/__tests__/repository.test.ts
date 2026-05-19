import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Repository } from '../repository';
import { getDb } from '../client';
import { AppError } from '../../lib/errors';

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

describe('Repository', () => {
  let repository: Repository;
  let mockExec: ReturnType<typeof vi.fn>;
  let mockDb: { exec: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockExec = createMockExec([]);
    mockDb = { exec: mockExec };
    (getDb as unknown as Mock).mockReturnValue(mockDb);
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
});
