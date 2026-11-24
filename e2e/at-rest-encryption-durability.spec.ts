import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { navClick, waitForAppReady } from './helpers/navigation';
import { readStoredState } from './helpers/store';
import { buildSeedState } from '../src/lib/studio/seed-state';
import { CURRENT_SCHEMA_VERSION } from '../src/lib/studio/hydration';
import type { Entity } from '../src/lib/studio/types';

/**
 * At-rest encryption durability (Plan 214 wave 9, ADR 048).
 *
 * The lifecycle spec (`at-rest-encryption.spec.ts`) proves the happy path on a
 * handful of notes. These specs attack the parts that only break under load or
 * interruption, against the real app:
 *
 *  - a 10k-record canonical corpus round-trips through encrypt → lock → reload →
 *    unlock, compared against the pre-encryption corpus in full;
 *  - a tab killed after the ciphertext landed but before the settings were
 *    written leaves a state the next load resolves without data loss;
 *  - a full store during the encrypted write fails closed, keeping the plaintext
 *    corpus and refusing to flag the workspace as encrypted;
 *  - an encrypted `.dksb` backup restores a readable, re-encryptable workspace on
 *    a fresh browser profile.
 *
 * Faults are injected where the browser itself is the failure: the crash is a
 * real renderer crash over CDP, and the quota case makes the real
 * `IDBObjectStore.put` throw QuotaExceededError for envelope writes only.
 */

const PASSPHRASE = 'correct horse battery staple';
const BACKUP_PASSPHRASE = 'portable backup passphrase';
const NEW_PASSPHRASE = 'restored workspace passphrase';

const CANONICAL_DB_NAME = 'dks-canonical';
const CANONICAL_OBJECT_STORE = 'state';
const CANONICAL_RECORD_KEY = 'studio-corpus';
const ENVELOPE_FORMAT = 'dks-at-rest-envelope';
const FLAG_KEY = 'dks-at-rest-encryption';
const SALT_KEY = 'dks-at-rest-salt';

const MARKER_NAME = 'Durability marker 1162';
const MARKER_CONTENT = 'This note proves the corpus survived the durability run.';

const LOCK_GATE_NAME = /this workspace is locked/i;
const UNLOCKED_STATUS = /On — unlocked for this tab only/;
/** Rows added for the large-corpus runs. */
const BULK_RECORDS = 10_000;
/** Rows used by the interruption and quota runs, where size is not the point. */
const MEDIUM_RECORDS = 2_000;
const SMALL_RECORDS = 200;
/** The stored canonical record, verbatim, whatever its shape. */
type RawRecord = Record<string, unknown> | null;
const lockGate = (page: Page) => page.getByRole('dialog', { name: LOCK_GATE_NAME });

/** Reads the canonical record without going through the app's storage adapter. */
const readRawRecord = (page: Page): Promise<RawRecord> =>
  page.evaluate(
    async ({ dbName, store, key }) => {
      const open = (): Promise<IDBDatabase | null> =>
        new Promise((resolve) => {
          const request = indexedDB.open(dbName);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          request.onblocked = () => resolve(null);
        });
      const db = await open();
      if (db === null) return null;
      try {
        return await new Promise<Record<string, unknown> | null>((resolve) => {
          try {
            const request = db.transaction(store, 'readonly').objectStore(store).get(key);
            request.onsuccess = () =>
              resolve((request.result as Record<string, unknown> | undefined) ?? null);
            request.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
      } finally {
        db.close();
      }
    },
    { dbName: CANONICAL_DB_NAME, store: CANONICAL_OBJECT_STORE, key: CANONICAL_RECORD_KEY },
  );

/** The durable at-rest settings: the flag and whether a public salt exists. */
const readAtRestSettings = (page: Page): Promise<{ enabled: boolean; salted: boolean }> =>
  page.evaluate(
    ({ flag, salt }) => ({
      enabled: localStorage.getItem(flag) === '1',
      salted: localStorage.getItem(salt) !== null,
    }),
    { flag: FLAG_KEY, salt: SALT_KEY },
  );

/** Number of entities in a stored record, ciphertext or not. */
const storedEntityCount = (record: RawRecord): number => {
  const state = record?.state as { entities?: unknown[] } | undefined;
  return Array.isArray(state?.entities) ? state.entities.length : 0;
};

/** Creates the marker note through the real editor, which creates the database. */
const createMarkerNote = async (page: Page): Promise<void> => {
  await navClick(page, /editor/i);
  await page.locator('#entity-name').fill(MARKER_NAME);
  const content = page.getByLabel('Editor content', { exact: true });
  await content.waitFor({ state: 'visible', timeout: 30_000 });
  await content.fill(MARKER_CONTENT);
  await page.getByRole('button', { name: 'Save to library' }).click();
  await navClick(page, /library/i);
  await expect(page.getByText(MARKER_NAME).first()).toBeVisible();
};

/**
 * Replaces the canonical record with a corpus of `count` bulk notes.
 *
 * Written straight to IndexedDB rather than through localStorage: a 10k-note
 * state is several megabytes, which is the one thing the legacy localStorage
 * envelope cannot hold. The record shape and schema version are the app's own
 * imports, so the app validates and hydrates this exactly as it would its own.
 */
const installBulkCorpus = async (page: Page, count: number): Promise<number> => {
  const seed = buildSeedState();
  const expected = seed.entities.length + count;
  await page.evaluate(
    async ({ dbName, store, recordKey, version, seedState, count: bulk }) => {
      const entities = Array.from({ length: bulk }, (_unused, index) => ({
        id: `bulk-${index}`,
        name: `Bulk note ${String(index).padStart(5, '0')}`,
        type: 'note',
        description: `Durability record ${index} of the at-rest corpus.`,
        content: `# Bulk note ${index}\n\nBody text for durability record ${index}.`,
        tags: ['bulk'],
        links: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }));
      const record = {
        state: { ...seedState, entities: [...seedState.entities, ...entities] },
        version,
      };
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(store, 'readwrite');
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error('write failed'));
          transaction.onabort = () => reject(transaction.error ?? new Error('write aborted'));
          transaction.objectStore(store).put(record, recordKey);
        });
      } finally {
        db.close();
      }
    },
    {
      dbName: CANONICAL_DB_NAME,
      store: CANONICAL_OBJECT_STORE,
      recordKey: CANONICAL_RECORD_KEY,
      version: CURRENT_SCHEMA_VERSION,
      seedState: seed,
      count,
    },
  );
  return expected;
};

/** Waits until the hydrated store holds `expected` entities. */
const expectHydratedCount = async (page: Page, expected: number): Promise<void> => {
  await expect
    .poll(async () => (await readStoredState(page))?.entities?.length ?? 0, { timeout: 120_000 })
    .toBe(expected);
};

/** Exports the current library through the Export view and parses the file. */
const exportJson = async (page: Page): Promise<{ entities: Entity[] }> => {
  await navClick(page, /^export/i);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^JSON/ }).click(),
  ]);
  const path = await download.path();
  if (path === null) throw new Error('the JSON export produced no file');
  return JSON.parse(await readFile(path, 'utf8')) as { entities: Entity[] };
};

/** Enables encryption from Settings on an unlocked, unencrypted workspace. */
const enableEncryption = async (page: Page, passphrase = PASSPHRASE): Promise<void> => {
  await navClick(page, /settings/i);
  await page.getByLabel('Passphrase', { exact: true }).fill(passphrase);
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(passphrase);
  await page.getByRole('button', { name: 'Encrypt this workspace' }).click();
  await expect(page.getByText(UNLOCKED_STATUS)).toBeVisible({ timeout: 180_000 });
};

/** Locks, reloads into the gate, and unlocks with `passphrase`. */
const lockReloadUnlock = async (page: Page, passphrase = PASSPHRASE): Promise<void> => {
  await page.getByRole('button', { name: 'Lock now' }).click();
  await expect(lockGate(page)).toBeVisible();
  await page.reload();
  await waitForAppReady(page);
  await expect(lockGate(page)).toBeVisible();
  await lockGate(page).getByLabel('Passphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Unlock workspace' }).click();
  await expect(lockGate(page)).toBeHidden({ timeout: 120_000 });
};

/**
 * Kills the tab at the exact durable boundary the interruption case is about:
 * the ciphertext has been committed, but the read-back that gates the settings
 * write has not returned.
 *
 * A whole migration takes ~300ms, so racing a real kill against it would mostly
 * land before or after the window. Instead the page's own `IDBObjectStore.put`
 * marks the moment the envelope lands and suspends the verification read — the
 * app is genuinely blocked mid-migration — and then the tab is closed, which is
 * what a killed tab leaves on disk: a complete envelope, no flag, no salt.
 *
 * The pause is installed at runtime (not an init script) so the page that
 * recovers the workspace is unaffected.
 */
const killTabMidVerification = async (page: Page, passphrase: string): Promise<void> => {
  await navClick(page, /settings/i);
  await page.getByLabel('Passphrase', { exact: true }).fill(passphrase);
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(passphrase);
  await page.evaluate(() => {
    const scope = window as unknown as { __dksEnvelopeWritten?: boolean };
    scope.__dksEnvelopeWritten = false;
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function patchedPut(
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (
        value !== null &&
        typeof value === 'object' &&
        (value as { format?: string }).format === 'dks-at-rest-envelope'
      ) {
        scope.__dksEnvelopeWritten = true;
        // The verification read never resolves: the migration is suspended.
        IDBObjectStore.prototype.get = function suspendedGet(): never {
          return new Promise<never>(() => undefined) as unknown as never;
        } as typeof IDBObjectStore.prototype.get;
      }
      return originalPut.call(this, value, key);
    } as typeof IDBObjectStore.prototype.put;
  });

  await page.getByRole('button', { name: 'Encrypt this workspace' }).click();
  const envelopeLanded = () =>
    page.evaluate(() => (window as unknown as { __dksEnvelopeWritten?: boolean }).__dksEnvelopeWritten === true);
  await expect.poll(envelopeLanded, { timeout: 60_000 }).toBe(true);
  // Give the put transaction time to commit, then kill the tab.
  await page.waitForTimeout(250);
  await page.close({ runBeforeUnload: false });
};

test.describe('At-rest encryption durability', () => {
  test('round-trips a 10k-record corpus through lock, reload and unlock', async ({ page }) => {
    test.setTimeout(420_000);
    await page.goto('/');
    await waitForAppReady(page);
    await createMarkerNote(page);

    const expected = await installBulkCorpus(page, BULK_RECORDS);
    await page.reload();
    await waitForAppReady(page);
    await expectHydratedCount(page, expected);

    // The full pre-encryption corpus, as the app itself exports it.
    const before = await exportJson(page);
    expect(before.entities).toHaveLength(expected);

    await enableEncryption(page);
    const encrypted = await readRawRecord(page);
    expect(encrypted?.format).toBe(ENVELOPE_FORMAT);
    // Ciphertext only: the bulk ids/names are not readable in the record.
    expect(JSON.stringify(encrypted)).not.toContain('Bulk note 00001');

    await lockReloadUnlock(page);

    // Full-corpus comparison, not a sample: every id, name, body and tag.
    const after = await exportJson(page);
    expect(after.entities).toHaveLength(expected);
    expect(after.entities).toEqual(before.entities);
    expect((await readRawRecord(page))?.format).toBe(ENVELOPE_FORMAT);
  });

  test('a tab killed mid-migration leaves a recoverable, non-garbage state', async ({
    page,
    context,
  }) => {
    test.setTimeout(300_000);
    await page.goto('/');
    await waitForAppReady(page);
    await createMarkerNote(page);

    const expected = await installBulkCorpus(page, MEDIUM_RECORDS);
    await page.reload();
    await waitForAppReady(page);
    await expectHydratedCount(page, expected);
    const before = await exportJson(page);

    await killTabMidVerification(page, PASSPHRASE);

    // The next load is a fresh page against the same profile storage.
    const revived = await context.newPage();
    await revived.goto('/');
    await waitForAppReady(revived);

    const raw = await readRawRecord(revived);
    const settings = await readAtRestSettings(revived);

    if (raw?.format === ENVELOPE_FORMAT) {
      // Fully encrypted bytes: a complete, authenticated envelope, not a
      // half-written record.
      expect(raw.formatVersion).toBe(1);
      expect(raw.kdf).toBe('PBKDF2-HMAC-SHA256');
      expect(Number(raw.iterations)).toBeGreaterThanOrEqual(600_000);
      expect(String(raw.ciphertext ?? '').length).toBeGreaterThan(1_000);

      if (settings.enabled) {
        // Finished the settings write: the workspace is simply locked.
        await expect(lockGate(revived)).toBeVisible();
        await lockGate(revived).getByLabel('Passphrase').fill(PASSPHRASE);
        await revived.getByRole('button', { name: 'Unlock workspace' }).click();
        await expect(lockGate(revived)).toBeHidden({ timeout: 120_000 });
      } else {
        // Killed before the settings write: the enable form finishes the setup
        // with the same passphrase and must reopen the corpus in place.
        await enableEncryption(revived, PASSPHRASE);
        await expect(
          revived
            .locator('section[aria-labelledby="settings-encryption-title"]')
            .getByRole('alert'),
        ).toHaveCount(0);
      }
    } else {
      // Killed before the encrypted write: the plaintext corpus is untouched.
      expect(settings.enabled).toBe(false);
      expect(storedEntityCount(raw)).toBe(expected);
      await expectHydratedCount(revived, expected);
    }

    // Either way the whole corpus is back, byte-identical to the baseline.
    const recovered = await exportJson(revived);
    expect(recovered.entities).toHaveLength(expected);
    expect(recovered.entities).toEqual(before.entities);
    expect((await readRawRecord(revived))?.format).toBe(ENVELOPE_FORMAT);
  });

  test('a full browser store fails the encrypted write closed and keeps the corpus', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    // Fault injection: only envelope writes hit the quota wall, so the rollback
    // (a plaintext write) still fits — exactly the shape of a nearly-full disk.
    await page.addInitScript(() => {
      const scope = window as unknown as { __dksFailEnvelopeWrites?: boolean };
      scope.__dksFailEnvelopeWrites = false;
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function patched(
        this: IDBObjectStore,
        value: unknown,
        key?: IDBValidKey,
      ) {
        if (
          scope.__dksFailEnvelopeWrites === true &&
          value !== null &&
          typeof value === 'object' &&
          (value as { format?: string }).format === 'dks-at-rest-envelope'
        ) {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        }
        return original.call(this, value, key);
      } as typeof IDBObjectStore.prototype.put;
    });
    await page.goto('/');
    await waitForAppReady(page);
    await createMarkerNote(page);
    const expected = await installBulkCorpus(page, SMALL_RECORDS);
    await page.reload();
    await waitForAppReady(page);
    await expectHydratedCount(page, expected);

    await page.evaluate(() => {
      (window as unknown as { __dksFailEnvelopeWrites?: boolean }).__dksFailEnvelopeWrites = true;
    });

    await navClick(page, /settings/i);
    await page.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE);
    await page.getByLabel('Confirm passphrase', { exact: true }).fill(PASSPHRASE);
    await page.getByRole('button', { name: 'Encrypt this workspace' }).click();

    // The failure is surfaced, not swallowed…
    const panelError = page
      .locator('section[aria-labelledby="settings-encryption-title"]')
      .getByRole('alert');
    await expect(panelError).toContainText(/could not be stored/i, { timeout: 120_000 });
    await expect(panelError).toContainText(/out of space/i);
    // …the workspace is not flagged as encrypted…
    const settings = await readAtRestSettings(page);
    expect(settings.enabled).toBe(false);
    expect(settings.salted).toBe(false);
    await expect(page.getByText(/Off — the library is stored unencrypted/)).toBeVisible();
    // …and the original corpus is byte-for-byte where it was.
    const raw = await readRawRecord(page);
    expect(raw?.format).toBeUndefined();
    expect(storedEntityCount(raw)).toBe(expected);
    expect(JSON.stringify(raw)).not.toContain(ENVELOPE_FORMAT);

    // The user is not locked out of their notes.
    await page.reload();
    await waitForAppReady(page);
    await expect(lockGate(page)).toHaveCount(0);
    await expectHydratedCount(page, expected);
    await navClick(page, /library/i);
    await expect(page.getByText('Bulk note 00000').first()).toBeVisible();
  });

  test('an encrypted backup restores an unlockable workspace on a fresh profile', async ({
    page,
    browser,
  }) => {
    test.setTimeout(300_000);
    const directory = await mkdtemp(join(tmpdir(), 'dks-at-rest-backup-'));
    const archivePath = join(directory, 'workspace.dksb');
    await page.goto('/');
    await waitForAppReady(page);
    await createMarkerNote(page);
    // Readable baseline before the workspace is sealed.
    const baseline = await exportJson(page);
    const expected = baseline.entities.length;
    expect(expected).toBeGreaterThan(0);
    await enableEncryption(page);

    // Documented recovery route: a `.dksb` archive with its own passphrase.

    await navClick(page, /^export/i);
    await page.locator('#backup-passphrase').fill(BACKUP_PASSPHRASE);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download backup' }).click(),
    ]);
    await download.saveAs(archivePath);

    const fresh = await browser.newContext({ baseURL: 'http://localhost:3000' });
    try {
      const restored = await fresh.newPage();
      await restored.goto('/');
      await waitForAppReady(restored);

      await navClick(restored, /^export/i);
      await restored
        .locator('input[type=file][accept=".dksb,application/json"]')
        .setInputFiles(archivePath);
      // The archive is encrypted, so its own passphrase is required.
      await expect(restored.locator('#backup-restore-passphrase')).toBeVisible({
        timeout: 60_000,
      });
      await restored.locator('#backup-restore-passphrase').fill(BACKUP_PASSPHRASE);
      await restored
        .locator('section[aria-labelledby="backup-panel-title"]')
        .getByRole('button', { name: 'Preview restore' })
        .last()
        .click();
      const dialog = restored.getByRole('dialog');
      await expect(dialog).toContainText('Restore preview', { timeout: 60_000 });
      await dialog.getByRole('button', { name: 'Replace library' }).click();
      await expect(restored.getByText('Backup restored')).toBeVisible({ timeout: 60_000 });

      // The restored corpus is the source corpus, readable on the new profile.
      await expect
        .poll(async () => (await readStoredState(restored))?.entities?.length ?? 0, {
          timeout: 60_000,
        })
        .toBe(expected);
      expect(
        (await readStoredState(restored))?.entities.some((entity) => entity.name === MARKER_NAME),
      ).toBe(true);

      // …and it can be sealed again, which is what makes it a usable workspace.
      await enableEncryption(restored, NEW_PASSPHRASE);
      await lockReloadUnlock(restored, NEW_PASSPHRASE);
      await navClick(restored, /library/i);
      await expect(restored.getByText(MARKER_NAME).first()).toBeVisible();
      expect((await readRawRecord(restored))?.format).toBe(ENVELOPE_FORMAT);
    } finally {
      await fresh.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
