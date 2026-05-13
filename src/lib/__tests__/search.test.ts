import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { search } from '@orama/orama';

vi.mock('@orama/orama', () => ({
  create: vi.fn().mockResolvedValue({}),
  insert: vi.fn().mockResolvedValue('orama-internal-id'),
  remove: vi.fn().mockResolvedValue(undefined),
  search: vi.fn(),
}));

vi.mock('../../db/repository', () => ({
  repository: {
    getAllEntities: vi.fn().mockResolvedValue([]),
    getEntityById: vi.fn().mockResolvedValue(null),
    getClaimsByEntityId: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Search module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('exports', () => {
    it('should export searchKnowledge', async () => {
      const mod = await import('../search');
      expect(mod.searchKnowledge).toBeDefined();
    });

    it('should export initSearch', async () => {
      const mod = await import('../search');
      expect(mod.initSearch).toBeDefined();
    });
  });

  describe('removeFromSearchIndex', () => {
    it('should call Orama remove for entity and its claims', async () => {
      const { removeFromSearchIndex, initSearch, upsertToSearchIndex } = await import('../search');
      const { repository } = await import('../../db/repository');
      const { insert, remove } = await import('@orama/orama');

      await initSearch();

      const mockEntity = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Test', type: 'person' };
      const mockClaims = [{ id: '660e8400-e29b-41d4-a716-446655440001', statement: 'Statement' }];

      (repository.getEntityById as Mock).mockResolvedValue(mockEntity);
      (repository.getClaimsByEntityId as Mock).mockResolvedValue(mockClaims);
      (insert as Mock).mockResolvedValue('orama-internal-id');

      // First add to index to populate oramaIdMap
      await upsertToSearchIndex(mockEntity.id);

      // Then remove
      await removeFromSearchIndex(mockEntity.id);

      // Called for entity and for claim
      expect(remove).toHaveBeenCalled();
    });
  });
});

describe('search function', () => {
  it('should call Orama search with query', async () => {
    (search as Mock).mockResolvedValueOnce({ hits: [] });
    const { searchKnowledge } = await import('../search');
    await searchKnowledge('test query');
    expect(search).toHaveBeenCalled();
  });

  it('should map hit document to RankedResult', async () => {
    (search as Mock).mockResolvedValueOnce({
      hits: [{ score: 1.0, document: { id: '1', title: 'T', type: 'e', content: 'c' } }],
    });
    const { searchKnowledge } = await import('../search');
    const results = await searchKnowledge('q');
    expect(results[0]).toHaveProperty('id', '1');
    expect(results[0]).toHaveProperty('name', 'T');
    expect(results[0]).toHaveProperty('stage', 'orama');
  });
});
