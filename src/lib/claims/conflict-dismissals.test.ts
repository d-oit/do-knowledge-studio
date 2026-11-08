import { describe, expect, it } from 'vitest';
import {
  CONFLICT_DISMISSALS_KEY,
  dismissConflictPair,
  isPairDismissed,
  loadDismissedPairs,
} from './conflict-dismissals';

const makeStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
};

describe('conflict dismissals (#1059)', () => {
  it('round-trips through storage and survives reload', () => {
    const storage = makeStorage();
    expect(loadDismissedPairs(storage).size).toBe(0);
    dismissConflictPair('c1', 'c2', storage);
    expect(storage.getItem(CONFLICT_DISMISSALS_KEY)).toContain('c1');
    const reloaded = loadDismissedPairs(storage);
    expect(isPairDismissed('c2', 'c1', reloaded)).toBe(true);
  });

  it('returns empty on corrupt payload', () => {
    const storage = makeStorage();
    storage.setItem(CONFLICT_DISMISSALS_KEY, 'not-json');
    expect(loadDismissedPairs(storage).size).toBe(0);
  });
});
