import { describe, it, expect, vi } from 'vitest';
import { Repository } from '../../db/repository';

// Mock the database client
vi.mock('../../db/client', () => ({
  getDb: () => ({
    exec: vi.fn().mockReturnValue([{ id: '1', name: 'TRIZ', type: 'concept', description: 'Problem solving' }]),
  }),
}));

describe('Repository Search', () => {
  it('should search entities by name or description', async () => {
    const repo = new Repository();
    const results = await repo.searchEntities('TRIZ');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('TRIZ');
  });
});
