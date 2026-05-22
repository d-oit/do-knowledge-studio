import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { repository } from '../../db/repository.js';
import { upsertToSearchIndex, initSearch } from '../search.js';

vi.mock('../../db/repository.js', () => ({
  repository: {
    getAllEntities: vi.fn(),
    getClaimsByEntityId: vi.fn(),
    getAllClaims: vi.fn(),
    getEntityById: vi.fn(),
    exec: vi.fn().mockResolvedValue([]),
    transaction: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Search Incremental Update Benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('measures upsertToSearchIndex performance with 100 claims', async () => {
    const entityId = 'entity-1';
    const entity = {
      id: entityId,
      rowid: 1,
      name: 'Test Entity',
      type: 'person',
      description: 'A test entity description',
    };

    const claims = Array.from({ length: 100 }, (_, i) => ({
      id: `claim-${i}`,
      rowid: i + 100,
      entity_id: entityId,
      statement: `Claim statement number ${i}`,
      confidence: 1,
      verification_status: 'unverified',
    }));

    (repository.getAllEntities as Mock).mockResolvedValue([entity]);
    (repository.getAllClaims as Mock).mockResolvedValue(claims);
    (repository.getEntityById as Mock).mockResolvedValue(entity);
    (repository.getClaimsByEntityId as Mock).mockResolvedValue(claims);

    // Initialize search first
    await initSearch();

    const upsertPromise = upsertToSearchIndex(entityId);

    // Fast-forward debounce timer
    vi.runAllTimers();
    await upsertPromise;

    // Optimized, it calls getClaimsByEntityId 1 time:
    // 1. upsertToSearchIndex (passed to other functions)
    expect(repository.getClaimsByEntityId).toHaveBeenCalledTimes(1);

    // initSearch calls exec: 2 DELETEs (entity, claim) + 1 INSERT (entity) + 100 INSERTs (claims) = 103
    // removeFromSearchIndex calls exec: 1 (entity delete) + 1 (claims delete) = 2
    // upsertToSearchIndex calls exec: 1 (entity insert) + 1 (claims insert) = 2
    // Total exec calls expected: 103 + 2 + 2 = 107.
    expect(repository.exec).toHaveBeenCalledTimes(107);
  });
});
