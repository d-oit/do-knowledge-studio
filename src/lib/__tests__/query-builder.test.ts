import { describe, it, expect } from 'vitest';
import { buildQueryFromFilters, generateFilterId, type QueryFilter } from '../query-builder';

describe('query-builder', () => {
  describe('buildQueryFromFilters', () => {
    it('returns empty result for no filters', () => {
      const result = buildQueryFromFilters([]);
      expect(result.text).toBe('');
      expect(result.description).toBe('No filters applied');
    });

    it('builds single entity-type filter', () => {
      const filters: QueryFilter[] = [
        { id: '1', type: 'entity-type', value: 'concept', operator: 'and' },
      ];
      const result = buildQueryFromFilters(filters);
      expect(result.text).toBe('type:concept');
      expect(result.description).toContain('concept');
    });

    it('builds multiple filters with AND', () => {
      const filters: QueryFilter[] = [
        { id: '1', type: 'entity-type', value: 'person', operator: 'and' },
        { id: '2', type: 'tag', value: 'important', operator: 'and' },
      ];
      const result = buildQueryFromFilters(filters);
      expect(result.text).toContain('type:person');
      expect(result.text).toContain('tag:important');
    });

    it('builds text search filter', () => {
      const filters: QueryFilter[] = [
        { id: '1', type: 'text', value: 'react hooks', operator: 'and' },
      ];
      const result = buildQueryFromFilters(filters);
      expect(result.text).toBe('react hooks');
    });

    it('builds verification filter', () => {
      const filters: QueryFilter[] = [
        { id: '1', type: 'verification', value: 'verified', operator: 'and' },
      ];
      const result = buildQueryFromFilters(filters);
      expect(result.text).toBe('status:verified');
    });

    it('builds relation filter', () => {
      const filters: QueryFilter[] = [
        { id: '1', type: 'relation', value: 'contradicts', operator: 'and' },
      ];
      const result = buildQueryFromFilters(filters);
      expect(result.text).toBe('relation:contradicts');
    });
  });

  describe('generateFilterId', () => {
    it('generates unique ids', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateFilterId()));
      expect(ids.size).toBe(100);
    });
  });
});
