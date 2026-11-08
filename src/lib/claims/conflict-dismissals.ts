/**
 * Dismissed conflict pairs for #1059.
 *
 * Dismissals persist in the localStorage metadata envelope (never the corpus),
 * survive reload and sync (sync carries claims, not UI dismissals), and are
 * validated with Zod at the boundary.
 */
import { z } from 'zod';
import { conflictPairKey } from './conflicts';

/** Storage key in the metadata envelope. */
export const CONFLICT_DISMISSALS_KEY = 'dks-conflict-dismissals-v1';

/** Boundary schema: array of `idA|idB` keys. */
const DismissalsSchema = z.array(z.string().min(1).max(300));

/** Loads dismissed pair keys (empty on missing/corrupt). */
export const loadDismissedPairs = (storage: Storage | null = null): Set<string> => {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store === null) return new Set();
    const raw = store.getItem(CONFLICT_DISMISSALS_KEY);
    if (raw === null || raw === '') return new Set();
    const parsed: unknown = JSON.parse(raw);
    const result = DismissalsSchema.safeParse(parsed);
    if (!result.success) return new Set();
    return new Set(result.data);
  } catch (error) {
    console.error('Failed to load dismissed conflicts', error);
    return new Set();
  }
};

/** Persists dismissed pair keys. */
export const saveDismissedPairs = (keys: ReadonlySet<string>, storage: Storage | null = null): void => {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store === null) return;
    store.setItem(CONFLICT_DISMISSALS_KEY, JSON.stringify([...keys]));
  } catch (error) {
    console.error('Failed to save dismissed conflicts', error);
  }
};

/** Marks a pair dismissed and persists. */
export const dismissConflictPair = (
  idA: string,
  idB: string,
  storage: Storage | null = null,
): Set<string> => {
  const keys = loadDismissedPairs(storage);
  keys.add(conflictPairKey(idA, idB));
  saveDismissedPairs(keys, storage);
  return keys;
};

/** True when the pair was dismissed. */
export const isPairDismissed = (idA: string, idB: string, keys: ReadonlySet<string>): boolean =>
  keys.has(conflictPairKey(idA, idB));
