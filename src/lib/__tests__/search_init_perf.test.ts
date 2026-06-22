import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { repository } from '../../db/repository.js';

vi.mock('../../db/repository.js', () => ({
  repository: {
    getAllEntities: vi.fn(),
    getClaimsByEntityId: vi.fn(),
    getAllClaims: vi.fn(),
    getAllNotes: vi.fn().mockResolvedValue([]),
    getEntityById: vi.fn(),
    exec: vi.fn().mockResolvedValue([]),
    transaction: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Search Initialization Benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('measures initSearch performance with 1000 entities and 5000 claims', { timeout: 60_000 }, async () => {
    const numEntities = 1000;
    const claimsPerEntity = 5;

    const entities = Array.from({ length: numEntities }, (_, i) => ({
      id: `entity-${i}`,
      name: `Entity ${i}`,
      type: 'person',
      description: `Description for entity ${i}`,
    }));

    const claims = Array.from({ length: numEntities * claimsPerEntity }, (_, i) => ({
      id: `claim-${i}`,
      entity_id: `entity-${Math.floor(i / claimsPerEntity)}`,
      statement: `Statement for claim ${i}`,
      confidence: 1,
      verification_status: 'unverified',
    }));

    (repository.getAllEntities as Mock).mockImplementation(
      (options?: { limit?: number; offset?: number }) => {
        const limit = options?.limit ?? entities.length;
        const offset = options?.offset ?? 0;
        return Promise.resolve(entities.slice(offset, offset + limit));
      },
    );
    (repository.getAllClaims as Mock).mockResolvedValue(claims);
    (repository.getEntityById as Mock).mockImplementation((entityId: string) => {
      return Promise.resolve(entities.find(e => e.id === entityId));
    });
    (repository.getClaimsByEntityId as Mock).mockImplementation((entityId: string) => {
      return Promise.resolve(claims.filter(c => c.entity_id === entityId));
    });

    const { initSearch } = await import('../search.js');

    const start = performance.now();
    await initSearch();
    const end = performance.now();

    console.log(`initSearch took ${end - start}ms`);

    expect(vi.mocked(repository.getAllEntities)).toHaveBeenCalledTimes(11); // 10 chunks + final empty check

    expect(vi.mocked(repository.getAllClaims)).toHaveBeenCalledTimes(1);
    // Should NOT call these during bulk init anymore

    expect(vi.mocked(repository.getEntityById)).toHaveBeenCalledTimes(0);
  });
});
