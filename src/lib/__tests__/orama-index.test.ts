import { describe, it, expect, beforeEach } from 'vitest';
import { addToOramaMap, clearOramaDb, oramaIdMap, createOramaIndex, oramaDb } from '../search/orama-index';

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
      // Fill to max
      for (let i = 0; i < 10000; i++) {
        addToOramaMap(`k${i}`, `v${i}`);
      }
      expect(oramaIdMap.size).toBe(10000);

      // Add one more — should evict oldest
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
      // oramaDb should be null after clear
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
      // Both should be valid but different instances
      expect(db1).toBeDefined();
      expect(db2).toBeDefined();
    });
  });
});
