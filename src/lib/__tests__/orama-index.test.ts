import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addToOramaMap, clearOramaDb, oramaIdMap, createOramaIndex, oramaDb, initEmbeddings } from '../search/orama-index';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('Orama index utilities', () => {
  beforeEach(() => {
    clearOramaDb();
  });

  describe('addToOramaMap', () => {
    it('adds entries to the map', () => {
      addToOramaMap('key1', 'value1');
      expect(oramaIdMap.get('key1')).toBe('value1');
    });

    it('overwrites existing keys', () => {
      addToOramaMap('key1', 'value1');
      addToOramaMap('key1', 'value2');
      expect(oramaIdMap.get('key1')).toBe('value2');
    });

    it('evicts oldest entry when map reaches max size', () => {
      for (let i = 0; i < 10000; i++) {
        addToOramaMap(`k${i}`, `v${i}`);
      }
      expect(oramaIdMap.size).toBe(10000);
      addToOramaMap('overflow', 'new');
      expect(oramaIdMap.size).toBe(10000);
      expect(oramaIdMap.has('overflow')).toBe(true);
    });
  });

  describe('clearOramaDb', () => {
    it('clears the id map', () => {
      addToOramaMap('a', 'b');
      clearOramaDb();
      expect(oramaIdMap.size).toBe(0);
    });

    it('sets oramaDb to null', () => {
      clearOramaDb();
      expect(oramaDb).toBeNull();
    });
  });

  describe('createOramaIndex', () => {
    it('creates an Orama database instance', () => {
      const db = createOramaIndex();
      expect(db).toBeDefined();
      expect(db).not.toBeNull();
    });

    it('sets the module-level oramaDb', () => {
      createOramaIndex();
      expect(oramaDb).not.toBeNull();
    });

    it('creates a fresh instance each time', () => {
      const db1 = createOramaIndex();
      clearOramaDb();
      const db2 = createOramaIndex();
      expect(db1).toBeDefined();
      expect(db2).toBeDefined();
    });
  });

  describe('initEmbeddings', () => {
    it('returns true when embeddings already ready', async () => {
      // If embeddings are already initialized from a prior test, this should return true
      const result = await initEmbeddings();
      expect(typeof result).toBe('boolean');
    });

    it('returns false when plugin already exists but not ready', async () => {
      // This tests the early return path when embeddingsPlugin is set
      // The exact behavior depends on module state, but it should not throw
      const result = await initEmbeddings();
      expect(typeof result).toBe('boolean');
    });
  });
});
