import { describe, it, expect, vi, beforeEach } from 'vitest';
import { search } from '@orama/orama';

vi.mock('@orama/orama', () => ({
  create: vi.fn().mockResolvedValue({
    insert: vi.fn().mockResolvedValue('orama-id'),
    remove: vi.fn().mockResolvedValue(undefined),
    search: vi.fn(),
  }),
  insert: vi.fn().mockResolvedValue('orama-internal-id'),
  remove: vi.fn().mockResolvedValue(undefined),
  search: vi.fn(),
}));

vi.mock('../../db/repository', () => ({
  repository: {
    getAllEntities: vi.fn().mockResolvedValue([]),
    getClaimsByEntityId: vi.fn().mockResolvedValue([]),
    getAllClaims: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../ai', () => ({
  aiService: {
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
    extractKnowledge: vi.fn(),
  },
}));

describe('Search module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exports', () => {
    it('should export searchKnowledge', async () => {
      const mod = await import('../search');
      expect(mod.searchKnowledge).toBeDefined();
      expect(typeof mod.searchKnowledge).toBe('function');
    });

    it('should export initSearch', async () => {
      const mod = await import('../search');
      expect(mod.initSearch).toBeDefined();
      expect(typeof mod.initSearch).toBe('function');
    });

    it('should export removeFromSearchIndex', async () => {
      const mod = await import('../search');
      expect(mod.removeFromSearchIndex).toBeDefined();
      expect(typeof mod.removeFromSearchIndex).toBe('function');
    });

    it('should export upsertToSearchIndex', async () => {
      const mod = await import('../search');
      expect(mod.upsertToSearchIndex).toBeDefined();
      expect(typeof mod.upsertToSearchIndex).toBe('function');
    });
  });
});

describe('search function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call Orama search with query', async () => {
    (search as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hits: [] });
    const { searchKnowledge } = await import('../search');
    await searchKnowledge('test query');
    expect(search).toHaveBeenCalled();
  });

  it('should return empty results when no hits', async () => {
    (search as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hits: [] });
    const { searchKnowledge } = await import('../search');
    const results = await searchKnowledge('nonexistent');
    expect(results).toEqual([]);
  });

  it('should map hit document to RankedResult', async () => {
    (search as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      hits: [{ document: { id: '1', title: 'T', type: 'e', content: 'c' }, score: 1.0 }],
    });
    const { searchKnowledge } = await import('../search');
    const results = await searchKnowledge('q');
    expect(results[0]).toHaveProperty('id', '1');
    expect(results[0]).toHaveProperty('name', 'T');
    expect(results[0]).toHaveProperty('type', 'e');
    expect(results[0]).toHaveProperty('excerpt', 'c');
  });

  it('should handle multiple hits', async () => {
    (search as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      hits: [
        { document: { id: '1', title: 'A', type: 'e', content: 'c' }, score: 0.9 },
        { document: { id: '2', title: 'B', type: 'e', content: 'c' }, score: 0.8 },
      ],
    });
    const { searchKnowledge } = await import('../search');
    const results = await searchKnowledge('query');
    expect(results).toHaveLength(2);
  });
});
