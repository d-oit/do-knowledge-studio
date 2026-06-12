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

describe('Repository — Claims & Links', () => {
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

  describe('updateClaim', () => {
    it('should update a claim', async () => {
      const mockClaim = createMockClaim({ id: OTHER_UUID, statement: 'Old statement' });
      const updatedClaim = createMockClaim({ id: OTHER_UUID, statement: 'New statement' });

      mockExec.mockResolvedValueOnce([mockClaim]);
      mockExec.mockResolvedValueOnce([updatedClaim]);

      const result = await repository.updateClaim(OTHER_UUID, { statement: 'New statement' });

      expect(mockExec).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('UPDATE claims SET statement = ?'),
        bind: expect.arrayContaining(['New statement', OTHER_UUID]),
      }));
      expect(result.statement).toBe('New statement');
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
});
