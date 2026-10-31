import type { Page } from '@playwright/test';
import { CURRENT_SCHEMA_VERSION, STUDIO_STORAGE_KEY } from '../../src/lib/studio/hydration';
import {
  CANONICAL_DB_NAME,
  CANONICAL_OBJECT_STORE,
  CANONICAL_RECORD_KEY,
} from '../../src/lib/studio/canonical-storage';
import { validatePersistedState, type ValidatedPersistedEnvelope } from '../../src/lib/studio/schema';
import { buildSeedState } from '../../src/lib/studio/seed-state';

/**
 * Shared store fixture (ADR 036 §Decision, "Shared fixtures").
 *
 * `seedStore` installs the Zustand persist envelope through
 * `page.addInitScript`, so the bytes are already in localStorage when the app's
 * hydration runs: the seeded library is what the very first render reads, with
 * nothing to clean up afterwards (the context is discarded at test end).
 *
 * The partial is merged over the app's own seed library and the result is
 * validated against the app's own `PersistedEnvelopeSchema` before the envelope
 * is built, so the fixture cannot drift from the app:
 *
 * - a schema change that the fixture's data no longer satisfies fails the test
 *   that seeded it, instead of silently hydrating as the default library and
 *   failing later on an unrelated assertion;
 * - `CURRENT_SCHEMA_VERSION` and the storage key are imported, never copied, so
 *   the envelope always claims the version the app's persist middleware expects.
 */

/** Persisted slice as the app defines it: the envelope schema minus `version` metadata. */
export type PersistedStudioState = Omit<ValidatedPersistedEnvelope, 'version'>;

/** The `{ state, version }` pair `zustand/persist` writes under one storage key. */
interface PersistEnvelope {
  state: ValidatedPersistedEnvelope;
  version: number;
}

/**
 * Merges `partial` over the seed library and validates the result.
 *
 * Keys the seed state carries but the schema does not persist (`searchQuery`,
 * `chatLoading`, `semanticSearchEnabled`) are dropped by Zod, exactly as they
 * are on a real hydration.
 */
const buildEnvelope = (partial: Partial<PersistedStudioState>): PersistEnvelope => {
  const verdict = validatePersistedState({ ...buildSeedState(), ...partial });
  if (!verdict.success) {
    const details = verdict.errors
      .map((error) => `  - ${error.path || '(root)'}: ${error.message}`)
      .join('\n');
    throw new Error(`seedStore: seeded state fails PersistedEnvelopeSchema:\n${details}`);
  }
  return { state: verdict.data, version: CURRENT_SCHEMA_VERSION };
};

/**
 * Seeds the studio store with `partial` before the page loads.
 *
 * Call it before `page.goto(...)`; every field the partial omits comes from the
 * app's seed library, so a spec only states the state it is actually about.
 */
export const seedStore = async (
  page: Page,
  partial: Partial<PersistedStudioState> = {},
): Promise<void> => {
  const envelope = buildEnvelope(partial);
  await page.addInitScript(
    ({ storageKey, serialized }) => {
      localStorage.setItem(storageKey, serialized);
    },
    { storageKey: STUDIO_STORAGE_KEY, serialized: JSON.stringify(envelope) },
  );
};

/**
 * Read the persisted studio state after hydration.
 *
 * Since Issue #1036 the canonical corpus lives in IndexedDB. The legacy
 * localStorage envelope is still read as a fallback because a refused
 * future-version fixture is deliberately never migrated.
 */
export const readStoredState = async (
  page: Page,
): Promise<PersistedStudioState | null> =>
  page.evaluate(
    async ({ storageKey, dbName, objectStore, recordKey }) => {
      const fromIdb = async (): Promise<unknown> => {
        if (typeof indexedDB === 'undefined') return null
        const db = await new Promise<IDBDatabase | null>((resolve) => {
          const request = indexedDB.open(dbName, 1)
          request.onupgradeneeded = () => {
            const database = request.result
            if (!database.objectStoreNames.contains(objectStore)) {
              database.createObjectStore(objectStore)
            }
          }
          request.onsuccess = () => { resolve(request.result) }
          request.onerror = () => { resolve(null) }
          request.onblocked = () => { resolve(null) }
        })
        if (db === null) return null
        const value = await new Promise<unknown>((resolve) => {
          const transaction = db.transaction(objectStore, 'readonly')
          const request = transaction.objectStore(objectStore).get(recordKey)
          request.onsuccess = () => { resolve(request.result) }
          request.onerror = () => { resolve(null) }
        })
        db.close()
        return value
      }
      const idbValue = (await fromIdb()) as { state?: unknown } | null
      if (idbValue?.state) return idbValue.state
      const raw = localStorage.getItem(storageKey)
      if (raw === null) return null
      try {
        const parsed = JSON.parse(raw) as { state?: unknown }
        return parsed.state ?? null
      } catch {
        return null
      }
    },
    {
      storageKey: STUDIO_STORAGE_KEY,
      dbName: CANONICAL_DB_NAME,
      objectStore: CANONICAL_OBJECT_STORE,
      recordKey: CANONICAL_RECORD_KEY,
    },
  ) as Promise<PersistedStudioState | null>;
