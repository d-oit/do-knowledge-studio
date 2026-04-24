import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Repository } from '../repository';
import { getDb } from '../client';
import { AppError } from '../../lib/errors';

// Mock the client module
vi.mock('../client', () => ({
  getDb: vi.fn(),
  initDb: vi.fn(),
}));

// Mock crypto.randomUUID for happy-dom environment
vi.stubGlobal('crypto', {
  randomUUID: () => '550e8400-e29b-41d4-a716-446655440000',
});

// Helper to create mock DB exec function
function createMockExec(returnValue: unknown) {
  return vi.fn().mockResolvedValue(returnValue);
}

// Helper to create mock entity
function createMockEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Entity',
    type: 'person',
    description: 'A test entity',
    metadata: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to create mock claim
function createMockClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: '660e8400-e29b-41d4-a716-446655440001',
    entity_id: '550e8400-e29b-41d4-a716-446655440000',
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
    id: '770e8400-e29b-41d4-a716-446655440002',
    entity_id: '550e8400-e29b-41d4-a716-446655440000',
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
    id: '880e8400-e29b-41d4-a716-446655440003',
    source_id: '550e8400-e29b-41d4-a716-446655440000',
    target_id: '990e8400-e29b-41d4-a716-446655440004',
    relation: 'related',
    metadata: null,
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
      const mockEntity = createMockEntity();
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

    it('should parse metadata from JSON string', async () => {
      const mockEntity = createMockEntity({ metadata: '{"key":"value"}' });
      mockExec.mockResolvedValue([mockEntity]);

      const result = await repository.createEntity({
        name: 'Test Entity',
        type: 'person',
      });

      expect(result.metadata).toEqual({ key: 'value' });
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
        createMockEntity({ name: 'Alice', id: '1' }),
        createMockEntity({ name: 'Bob', id: '2' }),
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

    it('should return empty array when no entities exist', async () => {
      mockExec.mockResolvedValue([]);

      const result = await repository.getAllEntities();

      expect(result).toEqual([]);
    });

    it('should parse metadata for each entity', async () => {
      const mockEntities = [
        createMockEntity({ metadata: '{"type":"test"}' }),
        createMockEntity({ metadata: null }),
      ];
      mockExec.mockResolvedValue(mockEntities);

      const result = await repository.getAllEntities();

      expect(result[0].metadata).toEqual({ type: 'test' });
      expect(result[1].metadata).toBeNull();
    });

    it('should throw AppError on database failure', async () => {
      mockExec.mockRejectedValue(new Error('DB error'));

      await expect(repository.getAllEntities()).rejects.toThrow(AppError);
    });
  });

  describe('searchEntities', () => {
    it('should search using FTS5', async () => {
      const mockEntities = [createMockEntity({ name: 'Alice' })];
      mockExec.mockResolvedValueOnce(mockEntities);

      const result = await repository.searchEntities('Alice');

      expect(mockExec).toHaveBeenCalledWith({
        sql: expect.stringContaining('search_idx MATCH'),
        bind: ['Alice'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toHaveLength(1);
    });

    it('should fallback to LIKE search when FTS5 returns no results', async () => {
      mockExec.mockResolvedValueOnce([]); // FTS5 returns nothing
      const mockEntities = [createMockEntity({ name: 'Bob' })];
      mockExec.mockResolvedValueOnce(mockEntities); // LIKE returns results

      const result = await repository.searchEntities('Bob');

      expect(mockExec).toHaveBeenCalledTimes(2);
      expect(mockExec.mock.calls[1][0]).toEqual({
        sql: expect.stringContaining('LIKE'),
        bind: ['%Bob%', '%Bob%'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when both FTS5 and LIKE return nothing', async () => {
      mockExec.mockResolvedValueOnce([]); // FTS5
      mockExec.mockResolvedValueOnce([]); // LIKE

      const result = await repository.searchEntities('nonexistent');

      expect(result).toEqual([]);
    });

    it('should throw AppError on database failure', async () => {
      mockExec.mockRejectedValue(new Error('DB error'));

      await expect(repository.searchEntities('test')).rejects.toThrow(AppError);
    });
  });

  describe('createClaim', () => {
    it('should create a claim with all fields', async () => {
      const mockClaim = createMockClaim();
      mockExec.mockResolvedValue([mockClaim]);

      const result = await repository.createClaim({
        entity_id: '550e8400-e29b-41d4-a716-446655440000',
        statement: 'Test claim',
        evidence: 'Test evidence',
        confidence: 0.9,
        source: 'Test source',
      });

      expect(mockExec).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO claims'),
        bind: ['550e8400-e29b-41d4-a716-446655440000', 'Test claim', 'Test evidence', 0.9, 'Test source', 'unverified'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result.statement).toBe('Test claim statement');
    });

    it('should create a claim with optional fields as null', async () => {
      const mockClaim = createMockClaim({ evidence: null, source: null });
      mockExec.mockResolvedValue([mockClaim]);

      const result = await repository.createClaim({
        entity_id: '550e8400-e29b-41d4-a716-446655440000',
        statement: 'Test claim',
        confidence: 1,
      });

      expect(mockExec).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO claims'),
        bind: ['550e8400-e29b-41d4-a716-446655440000', 'Test claim', null, 1, null, 'unverified'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toBeDefined();
    });

    it('should throw AppError on database failure', async () => {
      mockExec.mockRejectedValue(new Error('DB error'));

      await expect(
        repository.createClaim({
          entity_id: '550e8400-e29b-41d4-a716-446655440000',
          statement: 'Test',
          confidence: 1,
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('getClaimsByEntityId', () => {
    it('should return claims for an entity ordered by created_at DESC', async () => {
      const mockClaims = [
        createMockClaim({ id: '1', statement: 'Claim 1' }),
        createMockClaim({ id: '2', statement: 'Claim 2' }),
      ];
      mockExec.mockResolvedValue(mockClaims);

      const result = await repository.getClaimsByEntityId('550e8400-e29b-41d4-a716-446655440000');

      expect(mockExec).toHaveBeenCalledWith({
        sql: 'SELECT * FROM claims WHERE entity_id = ? ORDER BY created_at DESC',
        bind: ['550e8400-e29b-41d4-a716-446655440000'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no claims exist', async () => {
      mockExec.mockResolvedValue([]);

      const result = await repository.getClaimsByEntityId('nonexistent-id');

      expect(result).toEqual([]);
    });

    it('should throw AppError on database failure', async () => {
      mockExec.mockRejectedValue(new Error('DB error'));

      await expect(
        repository.getClaimsByEntityId('550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow(AppError);
    });
  });

  describe('createNote', () => {
    it('should create a note with all fields', async () => {
      const mockNote = createMockNote();
      mockExec.mockResolvedValue([mockNote]);

      const result = await repository.createNote({
        entity_id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Test note content',
        format: 'markdown',
      });

      expect(mockExec).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO notes'),
        bind: ['550e8400-e29b-41d4-a716-446655440000', 'Test note content', 'markdown'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result.content).toBe('Test note content');
    });

    it('should create a note with null entity_id', async () => {
      const mockNote = createMockNote({ entity_id: null });
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

    it('should throw AppError on database failure', async () => {
      mockExec.mockRejectedValue(new Error('DB error'));

      await expect(
        repository.createNote({
          content: 'Test',
          format: 'markdown',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('getNotesByEntityId', () => {
    it('should return notes for an entity ordered by created_at DESC', async () => {
      const mockNotes = [
        createMockNote({ id: '1', content: 'Note 1' }),
        createMockNote({ id: '2', content: 'Note 2' }),
      ];
      mockExec.mockResolvedValue(mockNotes);

      const result = await repository.getNotesByEntityId('550e8400-e29b-41d4-a716-446655440000');

      expect(mockExec).toHaveBeenCalledWith({
        sql: 'SELECT * FROM notes WHERE entity_id = ? ORDER BY created_at DESC',
        bind: ['550e8400-e29b-41d4-a716-446655440000'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no notes exist', async () => {
      mockExec.mockResolvedValue([]);

      const result = await repository.getNotesByEntityId('nonexistent-id');

      expect(result).toEqual([]);
    });

    it('should throw AppError on database failure', async () => {
      mockExec.mockRejectedValue(new Error('DB error'));

      await expect(
        repository.getNotesByEntityId('550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow(AppError);
    });
  });

  describe('createLink', () => {
    it('should create a link with all fields', async () => {
      const mockLink = createMockLink();
      mockExec.mockResolvedValue([mockLink]);

      const result = await repository.createLink({
        source_id: '550e8400-e29b-41d4-a716-446655440000',
        target_id: '990e8400-e29b-41d4-a716-446655440004',
        relation: 'related',
        metadata: { strength: 0.9 },
      });

      expect(mockExec).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO links'),
        bind: ['550e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440004', 'related', '{"strength":0.9}'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result.relation).toBe('related');
    });

    it('should create a link without metadata', async () => {
      const mockLink = createMockLink({ metadata: null });
      mockExec.mockResolvedValue([mockLink]);

      const result = await repository.createLink({
        source_id: '550e8400-e29b-41d4-a716-446655440000',
        target_id: '990e8400-e29b-41d4-a716-446655440004',
        relation: 'related',
      });

      expect(mockExec).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO links'),
        bind: ['550e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440004', 'related', null],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toBeDefined();
    });

    it('should parse metadata from JSON string', async () => {
      const mockLink = createMockLink({ metadata: '{"strength":0.9}' });
      mockExec.mockResolvedValue([mockLink]);

      const result = await repository.createLink({
        source_id: '550e8400-e29b-41d4-a716-446655440000',
        target_id: '990e8400-e29b-41d4-a716-446655440004',
        relation: 'related',
      });

      expect(result.metadata).toEqual({ strength: 0.9 });
    });

    it('should throw AppError on database failure', async () => {
      mockExec.mockRejectedValue(new Error('DB error'));

      await expect(
        repository.createLink({
          source_id: '550e8400-e29b-41d4-a716-446655440000',
          target_id: '990e8400-e29b-41d4-a716-446655440004',
          relation: 'related',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('getAllLinks', () => {
    it('should return all links', async () => {
      const mockLinks = [
        createMockLink({ id: '1', relation: 'related' }),
        createMockLink({ id: '2', relation: 'depends_on' }),
      ];
      mockExec.mockResolvedValue(mockLinks);

      const result = await repository.getAllLinks();

      expect(mockExec).toHaveBeenCalledWith({
        sql: 'SELECT * FROM links',
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no links exist', async () => {
      mockExec.mockResolvedValue([]);

      const result = await repository.getAllLinks();

      expect(result).toEqual([]);
    });

    it('should parse metadata for each link', async () => {
      const mockLinks = [
        createMockLink({ metadata: '{"type":"strong"}' }),
        createMockLink({ metadata: null }),
      ];
      mockExec.mockResolvedValue(mockLinks);

      const result = await repository.getAllLinks();

      expect(result[0].metadata).toEqual({ type: 'strong' });
      expect(result[1].metadata).toBeNull();
    });

    it('should throw AppError on database failure', async () => {
      mockExec.mockRejectedValue(new Error('DB error'));

      await expect(repository.getAllLinks()).rejects.toThrow(AppError);
    });
  });

  describe('parseMetadata', () => {
    it('should parse valid JSON metadata', async () => {
      const mockEntity = createMockEntity({ metadata: '{"key":"value"}' });
      mockExec.mockResolvedValue([mockEntity]);

      const result = await repository.createEntity({
        name: 'Test',
        type: 'test',
      });

      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('should handle invalid JSON metadata gracefully', async () => {
      const mockEntity = createMockEntity({ metadata: 'invalid-json' });
      mockExec.mockResolvedValue([mockEntity]);

      const result = await repository.createEntity({
        name: 'Test',
        type: 'test',
      });

      expect(result.metadata).toEqual({});
    });

    it('should handle null metadata', async () => {
      const mockEntity = createMockEntity({ metadata: null });
      mockExec.mockResolvedValue([mockEntity]);

      const result = await repository.createEntity({
        name: 'Test',
        type: 'test',
      });

      expect(result.metadata).toBeNull();
    });
  });
});
