import { describe, it, expect, beforeEach } from 'vitest';
import { perf } from '../perf/core';

// In vitest, import.meta.env.DEV is true and window exists (happy-dom),
// so perf.mark/perf.measure will actually execute.

describe('perf', () => {
  beforeEach(() => {
    perf.clear();
  });

  describe('mark and measure', () => {
    it('mark creates a performance mark without throwing', () => {
      expect(() => perf.mark('test-mark')).not.toThrow();
    });

    it('measure returns a duration after mark', () => {
      perf.mark('start');
      // Small busy-wait to ensure measurable duration
      const t0 = performance.now();
      while (performance.now() - t0 < 2) { /* spin */ }
      const duration = perf.measure('test-measure', 'start');
      expect(duration).not.toBeNull();
      expect(typeof duration).toBe('number');
    });

    it('measure stores entries', () => {
      perf.mark('a');
      perf.measure('entry-a', 'a');
      const entries = perf.getEntries();
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries.some(e => e.name === 'entry-a')).toBe(true);
    });
  });

  describe('getEntries', () => {
    it('returns empty array initially', () => {
      perf.clear();
      expect(perf.getEntries()).toEqual([]);
    });

    it('returns readonly entries', () => {
      perf.mark('x');
      perf.measure('test', 'x');
      const entries = perf.getEntries();
      expect(entries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getEntriesByName', () => {
    it('filters entries by name', () => {
      perf.mark('s1');
      perf.measure('filter-test', 's1');
      perf.mark('s2');
      perf.measure('other', 's2');
      const filtered = perf.getEntriesByName('filter-test');
      expect(filtered.every(e => e.name === 'filter-test')).toBe(true);
    });

    it('returns empty array for unknown name', () => {
      expect(perf.getEntriesByName('nonexistent')).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('returns null for unknown name', () => {
      expect(perf.getStats('unknown')).toBeNull();
    });

    it('returns stats with correct structure', () => {
      perf.mark('s');
      perf.measure('stats-test', 's');
      const stats = perf.getStats('stats-test');
      expect(stats).not.toBeNull();
      expect(stats!.name).toBe('stats-test');
      expect(stats!.count).toBe(1);
      expect(typeof stats!.avgMs).toBe('number');
      expect(typeof stats!.minMs).toBe('number');
      expect(typeof stats!.maxMs).toBe('number');
      expect(typeof stats!.lastMs).toBe('number');
    });
  });

  describe('getAllStats', () => {
    it('returns grouped stats', () => {
      perf.mark('a1');
      perf.measure('group-a', 'a1');
      perf.mark('a2');
      perf.measure('group-a', 'a2');
      perf.mark('b1');
      perf.measure('group-b', 'b1');

      const allStats = perf.getAllStats();
      const names = allStats.map(s => s.name);
      expect(names).toContain('group-a');
      expect(names).toContain('group-b');

      const groupA = allStats.find(s => s.name === 'group-a');
      expect(groupA!.count).toBe(2);
    });

    it('returns empty array when no entries', () => {
      perf.clear();
      expect(perf.getAllStats()).toEqual([]);
    });
  });

  describe('getStatsByCategory', () => {
    it('groups entries by category prefix', () => {
      perf.mark('s1');
      perf.measure('sqlite-query', 's1');
      perf.mark('s2');
      perf.measure('orama-search', 's2');

      const byCategory = perf.getStatsByCategory();
      expect(byCategory.has('SQLite')).toBe(true);
      expect(byCategory.has('Orama Search')).toBe(true);
    });

    it('categorizes known prefixes correctly', () => {
      const testCases = [
        { name: 'react:render', expected: 'React Render' },
        { name: 'sqlite-query', expected: 'SQLite' },
        { name: 'orama-search', expected: 'Orama Search' },
        { name: 'search-ui', expected: 'Search UI' },
        { name: 'app-boot', expected: 'App Boot' },
        { name: 'graph-render', expected: 'Graph Rendering' },
        { name: 'mindmap-load', expected: 'Mind Map' },
        { name: 'editor-save', expected: 'Editor' },
        { name: 'fts-index', expected: 'FTS Indexing' },
        { name: 'random-metric', expected: 'Other' },
      ];

      for (const tc of testCases) {
        perf.mark(`cat-${tc.name}`);
        perf.measure(tc.name, `cat-${tc.name}`);
      }

      const byCategory = perf.getStatsByCategory();
      for (const { name, expected } of testCases) {
        const stats = byCategory.get(expected);
        expect(stats, `Category '${expected}' should exist for '${name}'`).toBeDefined();
        expect(stats!.some(s => s.name === name)).toBe(true);
      }
    });
  });

  describe('clear', () => {
    it('clears all entries', () => {
      perf.mark('c1');
      perf.measure('clear-test', 'c1');
      expect(perf.getEntries().length).toBeGreaterThanOrEqual(1);
      perf.clear();
      expect(perf.getEntries().length).toBe(0);
    });
  });

  describe('MAX_ENTRIES limit', () => {
    it('caps entries at 500', () => {
      for (let i = 0; i < 510; i++) {
        perf.mark(`cap-${i}`);
        perf.measure(`cap-entry-${i}`, `cap-${i}`);
      }
      // After 510 entries, should be capped at 500
      expect(perf.getEntries().length).toBeLessThanOrEqual(500);
    });
  });
});
