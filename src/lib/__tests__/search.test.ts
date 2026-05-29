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
    getAllClaims: vi.fn().mockResolvedValue([]),
    getEntityById: vi.fn().mockResolvedValue(null),
    getClaimsByEntityId: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue([]),
    transaction: vi.fn().mockResolvedValue([]),
    updateEntity: vi.fn().mockResolvedValue({}),
    upsertWebCache: vi.fn().mockResolvedValue(undefined),
    getWebCache: vi.fn().mockResolvedValue(null),
    getClaimStageMap: vi.fn().mockResolvedValue(new Map()),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../resolver', () => ({
  resolveUrl: vi.fn().mockResolvedValue({
    url: 'https://example.com',
    title: 'Example',
    content: 'Lorem ipsum dolor sit amet',
    format: 'markdown',
    wordCount: 5,
    provider: 'jina',
  }),
}));

describe('Search module', () => {
  beforeEach(() => {
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
      hits: [{ document: { id: '1', title: 'T', type: 'e', content: 'c' }, score: 0.95 }],
    });
    const { searchKnowledge } = await import('../search');
    const results = await searchKnowledge('q');
    expect(results[0]).toHaveProperty('id', '1');
    expect(results[0]).toHaveProperty('title', 'T');
    expect(results[0]).toHaveProperty('score', 0.95);
  });
});

describe('External fetch handler', () => {
  it('should register external-fetch handler at module load', async () => {
    const { repository } = await import('../../db/repository');
    const { resolveUrl } = await import('../resolver');

    // Reset mocks from earlier imports
    vi.clearAllMocks();

    // Re-import search to trigger module-level handler registration
    await import('../search');

    // Enqueue an external-fetch job with mocked dependencies
    (repository.getWebCache as Mock).mockResolvedValue(null);
    (resolveUrl as Mock).mockResolvedValue({
      url: 'https://example.com',
      title: 'Test Page',
      content: 'Test content for entity',
      format: 'markdown',
      wordCount: 4,
      provider: 'jina',
    });

    // Import jobCoordinator and enqueue
    const { jobCoordinator } = await import('../jobs');
    vi.useFakeTimers();

    jobCoordinator.enqueue('external-fetch', 'entity-1', {
      url: 'https://example.com',
      entityId: 'entity-1',
    });

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    // Verify handler was registered and processed
    const metrics = jobCoordinator.getMetrics();
    expect(metrics.completed).toBe(1);
  });

  it('should use web cache when available instead of resolving URL', async () => {
    const { repository } = await import('../../db/repository');
    const { resolveUrl } = await import('../resolver');
    
    vi.clearAllMocks();

    // Cache hit: mock cached content
    (repository.getWebCache as Mock).mockResolvedValue({
      url: 'https://cached.example.com',
      content: 'Cached article content',
      format: 'markdown',
      title: 'Cached Article',
      resolved_at: '2025-01-01T00:00:00Z',
    });

    const { jobCoordinator: jc } = await import('../jobs');
    vi.useFakeTimers();

    jc.enqueue('external-fetch', 'entity-2', {
      url: 'https://cached.example.com',
      entityId: 'entity-2',
    });

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    // Should use cache, NOT call resolveUrl
    expect(resolveUrl).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(repository.getWebCache)).toHaveBeenCalledWith('https://cached.example.com');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(repository.updateEntity)).toHaveBeenCalledWith('entity-2', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      description: expect.stringContaining('Cached Article'),
    });
  });

  it('should handle missing handler gracefully when no handler registered', async () => {
    // Use a fresh JobCoordinator with no handler registered
    const { JobCoordinator } = await import('../jobs');
    const freshCoordinator = new JobCoordinator();
    vi.useFakeTimers();

    freshCoordinator.enqueue('external-fetch', 'entity-3', {
      url: 'https://no-handler.example.com',
      entityId: 'entity-3',
    });

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    // No handler → job fails gracefully
    const metrics = freshCoordinator.getMetrics();
    expect(metrics.failed).toBe(1);
  });

  it('should handle fetch errors without crashing', async () => {
    const { repository } = await import('../../db/repository');
    const { resolveUrl } = await import('../resolver');
    
    vi.clearAllMocks();

    (repository.getWebCache as Mock).mockResolvedValue(null);
    (resolveUrl as Mock).mockRejectedValue(new Error('Network error'));

    const { jobCoordinator: jc } = await import('../jobs');
    vi.useFakeTimers();

    const completedBefore = jc.getMetrics().completed;

    jc.enqueue('external-fetch', 'entity-4', {
      url: 'https://broken.example.com',
      entityId: 'entity-4',
    });

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    // handleExternalFetch catches errors internally, so the job completes
    expect(jc.getMetrics().completed).toBe(completedBefore + 1);
  });
});
