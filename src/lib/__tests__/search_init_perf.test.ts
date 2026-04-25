import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repository } from '../../db/repository.js';

// We need to mock @orama/orama to avoid actual indexing overhead if we just want to measure the N+1 problem,
// but wait, the task is about performance improvement. Measuring the actual Orama overhead is also important.
// However, in a test environment, we might want to mock it to focus on the repository calls if we can't run full Orama.
// Actually, Orama is a JS-only engine, it should work fine in Vitest.

vi.mock('../../db/repository.js', () => ({
  repository: {
    getAllEntities: vi.fn(),
    getClaimsByEntityId: vi.fn(),
    getAllClaims: vi.fn(),
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
    vi.resetModules();
  });

  it('measures initSearch performance with 100 entities and 500 claims', async () => {
    const numEntities = 100;
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

    (repository.getAllEntities as any).mockResolvedValue(entities);
    (repository.getAllClaims as any).mockResolvedValue(claims);
    (repository.getClaimsByEntityId as any).mockImplementation((entityId: string) => {
      return Promise.resolve(claims.filter(c => c.entity_id === entityId));
    });

    const { initSearch } = await import('../search.js');

    const start = performance.now();
    await initSearch();
    const end = performance.now();

    console.log(`initSearch took ${end - start}ms`);
    expect(repository.getAllEntities).toHaveBeenCalledTimes(1);
    expect(repository.getAllClaims).toHaveBeenCalledTimes(1);
  });
});
