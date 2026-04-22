import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchKnowledge } from '../search';
import { repository } from '../../db/repository';
import { search } from '@orama/orama';

// Mock repository
vi.mock('../../db/repository', () => ({
  repository: {
    searchFTS5: vi.fn(),
    getRelatedEntities: vi.fn(),
    getAllEntities: vi.fn().mockResolvedValue([]),
    getClaimsByEntityId: vi.fn().mockResolvedValue([]),
  },
}));

// Mock Orama
vi.mock('@orama/orama', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orama/orama')>();
  return {
    ...actual,
    create: vi.fn(),
    insert: vi.fn(),
    search: vi.fn(),
  };
});

describe('Search Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use FTS5 by default', async () => {
    vi.mocked(repository.searchFTS5).mockResolvedValue([
      { id: '1', name: 'TRIZ', type: 'concept', excerpt: 'Problem solving', score: 0.1 }
    ]);

    const results = await searchKnowledge('TRIZ', { stages: ['fts5'] });

    expect(repository.searchFTS5).toHaveBeenCalledWith('TRIZ');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
    expect(results[0].stage).toBe('fts5');
  });

  it('should use semantic fallback when FTS5 returns nothing', async () => {
    vi.mocked(repository.searchFTS5).mockResolvedValue([]);
    vi.mocked(search).mockResolvedValue({
      hits: [
        {
          document: { id: '2', name: 'Orama', type: 'tech', excerpt: 'Search engine' },
          score: 0.9
        }
      ],
      count: 1,
      elapsed: { raw: 0, formatted: '0ms' }
    } as any);

    const results = await searchKnowledge('Orama', { stages: ['fts5', 'semantic'] });

    expect(repository.searchFTS5).toHaveBeenCalled();
    expect(search).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
    expect(results[0].stage).toBe('semantic');
  });

  it('should optionally expand via graph', async () => {
    vi.mocked(repository.searchFTS5).mockResolvedValue([
      { id: '1', name: 'TRIZ', type: 'concept', excerpt: 'Problem solving', score: 0.1 }
    ]);
    vi.mocked(repository.getRelatedEntities).mockResolvedValue([
      { id: '3', name: 'Altshuller', type: 'person', description: 'Inventor of TRIZ' }
    ]);

    const results = await searchKnowledge('TRIZ', { stages: ['fts5', 'graph'] });

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('1');
    expect(results[1].id).toBe('3');
    expect(results[1].stage).toBe('graph');
  });
});
