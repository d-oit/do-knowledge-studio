import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
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
    getAllClaims: vi.fn().mockResolvedValue([]),
    getAllNotes: vi.fn().mockResolvedValue([]),
    getEntityById: vi.fn().mockResolvedValue(null),
    getClaimsByEntityId: vi.fn().mockResolvedValue([]),
    getClaimStageMap: vi.fn().mockResolvedValue(new Map()),
    exec: vi.fn().mockResolvedValue([]),
    transaction: vi.fn().mockResolvedValue([]),
    searchRelated: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../nlp', () => ({
  compressText: vi.fn((s: string) => s),
}));

vi.mock('../perf', () => ({
  perf: { mark: vi.fn(), measure: vi.fn() },
}));

describe('searchKnowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no results', async () => {
    (search as Mock).mockResolvedValue({ hits: [] });
    const { searchKnowledge } = await import('../search');
    const results = await searchKnowledge('nonexistent');
    expect(results).toEqual([]);
  });

  it('maps hits to RankedResult with enriched stage', async () => {
    (search as Mock).mockResolvedValue({
      hits: [
        { document: { id: '1', title: 'Entity', type: 'entity', content: 'desc', keywords: 'person' }, score: 0.9 },
        { document: { id: '2', title: 'Claim', type: 'claim', content: 'statement', keywords: 'e1' }, score: 0.7 },
      ],
    });
    const { searchKnowledge } = await import('../search');
    const results = await searchKnowledge('test');
    expect(results).toHaveLength(2);
    expect(results[0].stage).toBe('verified');
    expect(results[1].stage).toBeDefined();
  });

  it('applies type filter when provided', async () => {
    (search as Mock).mockResolvedValue({ hits: [] });
    const { searchKnowledge } = await import('../search');
    await searchKnowledge('q', { type: 'entity' });
    expect(search).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      where: { type: 'entity' },
    }));
  });

  it('uses custom limit', async () => {
    (search as Mock).mockResolvedValue({ hits: [] });
    const { searchKnowledge } = await import('../search');
    await searchKnowledge('q', { limit: 5 });
    expect(search).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      limit: 5,
    }));
  });
});

describe('semanticSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to keyword search when embeddings not ready', async () => {
    (search as Mock).mockResolvedValue({ hits: [] });
    const { semanticSearch } = await import('../search');
    const results = await semanticSearch('test');
    expect(results).toEqual([]);
    // Should use standard search params (no hybrid mode)
    expect(search).toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining({
      mode: 'hybrid',
    }));
  });
});

describe('progressiveSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onResults with exact stage', async () => {
    (search as Mock).mockResolvedValue({ hits: [] });
    const { repository } = await import('../../db/repository');
    vi.mocked(repository.searchRelated).mockResolvedValue([]);
    const { progressiveSearch } = await import('../search');
    const callback = vi.fn();
    await progressiveSearch('query', callback);
    expect(callback).toHaveBeenCalledWith(expect.anything(), 'exact');
  });

  it('skips semantic when semantic option is false', async () => {
    (search as Mock).mockResolvedValue({ hits: [] });
    const { repository } = await import('../../db/repository');
    vi.mocked(repository.searchRelated).mockResolvedValue([]);
    const { progressiveSearch } = await import('../search');
    const callback = vi.fn();
    await progressiveSearch('query', callback, { semantic: false });
    // Should only be called with 'exact', not 'semantic'
    const stages = callback.mock.calls.map((c: unknown[]) => c[1]);
    expect(stages).not.toContain('semantic');
  });

  it('calls onResults with related stage when results found', async () => {
    (search as Mock).mockResolvedValue({ hits: [] });
    const { repository } = await import('../../db/repository');
    vi.mocked(repository.searchRelated).mockResolvedValue([
      { id: 'r1', title: 'Related', type: 'entity', content: 'desc', score: 0.5, stage: 'related' },
    ]);
    const { progressiveSearch } = await import('../search');
    const callback = vi.fn();
    await progressiveSearch('query', callback);
    expect(callback).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'r1' })]), 'related');
  });

  it('returns early when signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { progressiveSearch } = await import('../search');
    const callback = vi.fn();
    await progressiveSearch('query', callback, { signal: controller.signal });
    expect(callback).not.toHaveBeenCalled();
  });

  it('throws AppError when related search fails', async () => {
    (search as Mock).mockResolvedValue({ hits: [] });
    const { repository } = await import('../../db/repository');
    vi.mocked(repository.searchRelated).mockRejectedValue(new Error('DB error'));
    const { progressiveSearch } = await import('../search');
    await expect(progressiveSearch('q', vi.fn())).rejects.toThrow('Related search failed');
  });
});
