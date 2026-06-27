import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/repository', () => ({
  repository: {
    getAllEntities: vi.fn().mockResolvedValue([]),
    getAllClaims: vi.fn().mockResolvedValue([]),
    getAllLinks: vi.fn().mockResolvedValue([]),
    getEntityById: vi.fn().mockResolvedValue(null),
    getEntityByName: vi.fn().mockResolvedValue(null),
    createLink: vi.fn().mockResolvedValue({ id: 'l1' }),
  },
}));

vi.mock('../search', () => ({
  searchKnowledge: vi.fn().mockResolvedValue([]),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { findConnectionSuggestions, findContradictionSuggestions, runSynthesis } from '../synthesis-agent';
import { repository } from '../../db/repository';

describe('synthesis-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findConnectionSuggestions', () => {
    it('returns empty when fewer than 2 entities', async () => {
      vi.mocked(repository.getAllEntities).mockResolvedValue([
        { id: 'e1', name: 'React', type: 'tech', description: 'UI library' },
      ]);
      const result = await findConnectionSuggestions();
      expect(result).toEqual([]);
    });

    it('finds connections between entities with shared keywords', async () => {
      vi.mocked(repository.getAllEntities).mockResolvedValue([
        { id: 'e1', name: 'React', type: 'tech', description: 'JavaScript UI library for building interfaces' },
        { id: 'e2', name: 'Vue', type: 'tech', description: 'JavaScript UI library for building interfaces' },
      ]);
      vi.mocked(repository.getAllLinks).mockResolvedValue([]);

      const result = await findConnectionSuggestions();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('connection');
    });

    it('excludes already linked entities', async () => {
      vi.mocked(repository.getAllEntities).mockResolvedValue([
        { id: 'e1', name: 'React', type: 'tech', description: 'JavaScript UI library' },
        { id: 'e2', name: 'Vue', type: 'tech', description: 'JavaScript UI library' },
      ]);
      vi.mocked(repository.getAllLinks).mockResolvedValue([
        { id: 'l1', source_id: 'e1', target_id: 'e2', relation: 'uses', created_at: '', updated_at: '' },
      ]);

      const result = await findConnectionSuggestions();
      expect(result).toEqual([]);
    });
  });

  describe('findContradictionSuggestions', () => {
    it('returns empty when fewer than 2 claims', async () => {
      vi.mocked(repository.getAllClaims).mockResolvedValue([
        { id: 'c1', entity_id: 'e1', statement: 'Test claim', confidence: 1 },
      ]);
      const result = await findContradictionSuggestions();
      expect(result).toEqual([]);
    });

    it('finds contradictions between opposing claims', async () => {
      vi.mocked(repository.getAllClaims).mockResolvedValue([
        { id: 'c1', entity_id: 'e1', statement: 'JavaScript is not type safe', confidence: 1 },
        { id: 'c2', entity_id: 'e2', statement: 'JavaScript is type safe with TypeScript', confidence: 1 },
      ]);
      vi.mocked(repository.getEntityById).mockImplementation((id: string) => {
        if (id === 'e1') return { id: 'e1', name: 'JS', type: 'tech' };
        return { id: 'e2', name: 'TS', type: 'tech' };
      });

      const result = await findContradictionSuggestions();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('contradiction');
    });
  });

  describe('runSynthesis', () => {
    it('combines connections and contradictions', async () => {
      vi.mocked(repository.getAllEntities).mockResolvedValue([]);
      vi.mocked(repository.getAllClaims).mockResolvedValue([]);

      const result = await runSynthesis();
      expect(result).toEqual([]);
    });
  });
});
