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

    (repository.getAllEntities as Mock).mockImplementation(
      (options?: { limit?: number; offset?: number }) => {
        const all = [entity];
        const limit = options?.limit ?? all.length;
        const offset = options?.offset ?? 0;
        return Promise.resolve(all.slice(offset, offset + limit));
      },
    );
    (repository.getAllClaims as Mock).mockResolvedValue(claims);
    (repository.getEntityById as Mock).mockResolvedValue(entity);
    (repository.getClaimsByEntityId as Mock).mockResolvedValue(claims);

    // Initialize search first
    await initSearch();

    const upsertPromise = upsertToSearchIndex(entityId);

    // Fast-forward debounce timer (500ms)
    await new Promise(resolve => setTimeout(resolve, 600));
    await upsertPromise;

    // Optimized, it calls getClaimsByEntityId 1 time:
    // 1. upsertToSearchIndex (passed to other functions)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(repository.getClaimsByEntityId)).toHaveBeenCalledTimes(1);

    // initSearch: 2 DELETEs + 2 set-based INSERTs = 4 exec
    // upsertToSearchIndex: 2 delete (removeFromSearchIndex) + 2 INSERT = 4 exec
    // Total exec calls: 4 + 4 = 8
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(repository.exec)).toHaveBeenCalledTimes(8);
    // No more batch transactions — FTS rebuild uses set-based SQL
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(repository.transaction)).toHaveBeenCalledTimes(0);
  });
});
