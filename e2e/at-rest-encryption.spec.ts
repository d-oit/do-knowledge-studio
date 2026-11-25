import { test, expect, type Page } from '@playwright/test';
import { navClick, waitForAppReady } from './helpers/navigation';
import { readStoredState } from './helpers/store';
import {
  CANONICAL_DB_NAME,
  CANONICAL_OBJECT_STORE,
  CANONICAL_RECORD_KEY,
} from '../src/lib/studio/canonical-storage';
import { REVISIONS_OBJECT_STORE } from '../src/lib/studio/canonical-storage-idb';
import {
  AT_REST_ENCRYPTION_FLAG_KEY,
  AT_REST_SALT_KEY,
} from '../src/lib/studio/at-rest-session';

/**
 * At-rest encryption, end to end (ADR 048, issue #1162).
 *
 * These specs drive the real app: enable encryption from Settings, prove the
 * library is still readable while unlocked, lock it, reload, prove the unlock
 * gate blocks access instead of showing an empty workspace, and prove the
 * correct passphrase reopens the same corpus while a wrong one does not.
 *
 * They also inspect the browser's own storage. A unit test can assert that the
 * encoder emitted an envelope; only a real browser can show that NO readable
 * copy of the corpus, the passphrase or the key survives in localStorage,
 * sessionStorage or IndexedDB while encryption is on.
 *
 * The marker note is created THROUGH THE UI rather than seeded into
 * localStorage. A seeded fixture would re-write its plaintext envelope on every
 * navigation (init scripts run on reload too), so the storage audit would be
 * measuring the fixture instead of the app.
 */

/** Passphrase used by every spec. Never stored anywhere by the app. */
const PASSPHRASE = 'correct horse battery staple';

/** A passphrase the workspace was never encrypted with. */
const WRONG_PASSPHRASE = 'not the passphrase you are looking for';

/** Marker note: created through the Editor, never part of the demo seed set. */
const MARKER_NAME = 'At-rest marker note 1162';
const MARKER_CONTENT = 'Readable only while the encrypted workspace is unlocked.';

/** Console line the capture probe emits to prove the listener is attached. */
const LOG_CAPTURE_PROBE = 'at-rest encryption log capture probe';

/** Browser output observed while a test drives the encryption lifecycle. */
interface BrowserLogCapture {
  /** Console messages, serialized arguments and page errors, one per entry. */
  readonly entries: string[];
  /** Argument serializations in flight; awaited before an assertion reads. */
  readonly serializing: Promise<void>[];
}

/** The only acceptable stored shape of an encrypted canonical record. */
const ENVELOPE_FORMAT = 'dks-at-rest-envelope';

/** Loads the app and waits for the shell to be interactive. */
const openWorkspace = async (page: Page): Promise<void> => {
  await page.goto('/');
  await waitForAppReady(page);
};

/** Creates the marker note through the real editor and saves it. */
const createMarkerNote = async (page: Page): Promise<void> => {
  await navClick(page, /editor/i);
  await page.locator('#entity-name').fill(MARKER_NAME);
  // The Markdown editor is lazy-loaded; its Suspense fallback carries the
  // label "Editor content loading", so match the real textarea exactly.
  const content = page.getByLabel('Editor content', { exact: true });
  await content.waitFor({ state: 'visible', timeout: 30_000 });
  await content.fill(MARKER_CONTENT);
  await page.getByRole('button', { name: 'Save to library' }).click();
  // The save is what persists the note; confirm it landed before encrypting.
  await navClick(page, /library/i);
  await expect(page.getByText(MARKER_NAME).first()).toBeVisible();
};

/** Opens Settings and waits for its view heading. */
const openSettings = async (page: Page): Promise<void> => {
  await navClick(page, /settings/i);
  await expect(page.getByRole('heading', { name: 'Settings', exact: true }).first()).toBeVisible();
};

/** The blocking unlock screen shown for an encrypted, locked workspace. */
const lockGate = (page: Page) =>
  page.getByRole('dialog', { name: /this workspace is locked/i });

/** Enables encryption from Settings and waits for the unlocked status line. */
const enableEncryption = async (page: Page): Promise<void> => {
  await page.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE);
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(PASSPHRASE);
  await page.getByRole('button', { name: 'Encrypt this workspace' }).click();
  // PBKDF2 at 600,000 iterations runs in the browser, so this is not instant.
  await expect(page.getByText(/On — unlocked for this tab only/)).toBeVisible({ timeout: 45_000 });
};

/** Locks the workspace and expects the gate to cover the app. */
const lockWorkspace = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Lock now' }).click();
  await expect(lockGate(page)).toBeVisible();
};

/** Types a passphrase into the lock gate and submits it. */
const submitPassphrase = async (page: Page, passphrase: string): Promise<void> => {
  await lockGate(page).getByLabel('Passphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Unlock workspace' }).click();
};

/**
 * Reads both object stores of the canonical database verbatim.
 *
 * Deliberately raw: the point is to see what is on disk, not to decode it. A
 * plaintext fallback, a decrypted revision, or an unencrypted envelope header
 * all show up here.
 */
const readCanonicalDatabase = (page: Page): Promise<unknown> =>
  page.evaluate(
    async ({ dbName, stateStore, revisionsStore, recordKey }) => {
      const open = (): Promise<IDBDatabase | null> =>
        new Promise((resolve) => {
          const request = indexedDB.open(dbName);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          request.onblocked = () => resolve(null);
        });
      const db = await open();
      if (db === null) return null;
      const read = (store: string, key: string | null): Promise<unknown> =>
        new Promise((resolve) => {
          try {
            const transaction = db.transaction(store, 'readonly');
            const objectStore = transaction.objectStore(store);
            const request = key === null ? objectStore.getAll() : objectStore.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
      const state = await read(stateStore, recordKey);
      const revisions = await read(revisionsStore, null);
      db.close();
      return { state, revisions };
    },
    {
      dbName: CANONICAL_DB_NAME,
      stateStore: CANONICAL_OBJECT_STORE,
      revisionsStore: REVISIONS_OBJECT_STORE,
      recordKey: CANONICAL_RECORD_KEY,
    },
  );

/**
 * Dumps every IndexedDB database and object store the origin has.
 *
 * The canonical store is not the only place workspace text can survive: the
 * Yjs replica (`dks-sync`), recovery snapshots and editor drafts each hold a
 * plaintext-capable copy. Enumerating the databases rather than naming them
 * means a side surface that starts persisting text later is caught here.
 */
const readAllIndexedDb = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const dump: Record<string, Record<string, unknown>> = {};
    const databases = await indexedDB.databases();
    for (const info of databases) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase | null>((resolve) => {
        const request = indexedDB.open(info.name as string);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      });
      if (db === null) continue;
      const stores: Record<string, unknown> = {};
      for (const store of Array.from(db.objectStoreNames)) {
        stores[store] = await new Promise<unknown>((resolve) => {
          try {
            const request = db.transaction(store, 'readonly').objectStore(store).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
      }
      db.close();
      dump[info.name] = stores;
    }
    return JSON.stringify(dump);
  });

/** Every localStorage and sessionStorage value, as one searchable string. */
const readBrowserStorage = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const dump = (storage: Storage): Record<string, string> => {
      const values: Record<string, string> = {};
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null) values[key] = storage.getItem(key) ?? '';
      }
      return values;
    };
    return JSON.stringify({ local: dump(localStorage), session: dump(sessionStorage) });
  });

/**
 * Records everything the page reports to its console, plus uncaught page errors.
 *
 * The app's logger writes through a console sink, so this is the browser-side
 * log stream. Arguments are serialized individually because the sink prints the
 * structured payload as a second argument, which `message.text()` can reduce to
 * an opaque object label.
 *
 * The probe line is emitted through the page before the test drives the app.
 * Every passphrase assertion requires it, so none can pass unless the listener
 * actually observed browser output.
 */
const watchBrowserLogs = async (page: Page): Promise<BrowserLogCapture> => {
  const capture: BrowserLogCapture = { entries: [], serializing: [] };
  page.on('console', (message) => {
    capture.entries.push(`console.${message.type()}: ${message.text()}`);
    for (const argument of message.args()) {
      capture.serializing.push(
        argument
          .jsonValue()
          .then((value) => {
            // `jsonValue` resolves only JSON-safe data, so this cannot throw.
            capture.entries.push(JSON.stringify(value) ?? '');
          })
          .catch(() => undefined),
      );
    }
  });
  page.on('pageerror', (error) => capture.entries.push(`pageerror: ${error.message}`));
  await page.evaluate((probe) => console.info(probe), LOG_CAPTURE_PROBE);
  return capture;
};

/**
 * Asserts that neither passphrase appears in anything the page logged.
 *
 * Requiring the capture probe means an empty capture, or one whose listener
 * stopped, fails instead of passing vacuously.
 */
const expectPassphrasesNeverLogged = async (capture: BrowserLogCapture): Promise<void> => {
  await Promise.all(capture.serializing);
  const observed = capture.entries.join('\n');
  expect(observed, 'no browser console output was captured').toContain(LOG_CAPTURE_PROBE);
  for (const secret of [PASSPHRASE, WRONG_PASSPHRASE]) {
    expect(observed, `browser console leaked: ${secret}`).not.toContain(secret);
  }
};

/** Asserts that no secret or note text appears in browser storage. */
const expectNoPlaintextAnywhere = async (page: Page): Promise<void> => {
  const storage = await readBrowserStorage(page);
  const canonical = JSON.stringify(await readCanonicalDatabase(page));
  const everyDatabase = await readAllIndexedDb(page);
  // The canonical store is read twice on purpose: a dedicated lookup proves the
  // record's shape, the enumeration proves nothing else holds the text.
  expect(everyDatabase, 'the IndexedDB dump must include the canonical store').toContain(
    CANONICAL_DB_NAME,
  );
  for (const forbidden of [MARKER_NAME, MARKER_CONTENT, PASSPHRASE]) {
    expect(storage, `browser storage leaked: ${forbidden}`).not.toContain(forbidden);
    expect(canonical, `canonical IndexedDB leaked: ${forbidden}`).not.toContain(forbidden);
    expect(everyDatabase, `IndexedDB leaked: ${forbidden}`).not.toContain(forbidden);
  }
};

/** Reads the stored canonical record's shape. */
const readStoredRecord = async (page: Page): Promise<{ format?: string } | null> => {
  const database = (await readCanonicalDatabase(page)) as { state: { format?: string } | null };
  return database.state;
};

test.describe('At-rest workspace encryption', () => {
  test('encrypts the library, keeps it readable while unlocked, and stores no plaintext', async ({
    page,
  }) => {
    const logs = await watchBrowserLogs(page);
    await openWorkspace(page);
    await createMarkerNote(page);
    await openSettings(page);
    // The irreversible-loss warning is shown before the passphrase is set.
    await expect(page.getByRole('note')).toContainText(/There is no recovery key/i);
    await enableEncryption(page);
    await expectPassphrasesNeverLogged(logs);

    // The stored record is an authenticated envelope, not a plaintext corpus.
    expect((await readStoredRecord(page))?.format).toBe(ENVELOPE_FORMAT);
    expect(await page.evaluate((key) => localStorage.getItem(key), AT_REST_ENCRYPTION_FLAG_KEY)).toBe(
      '1',
    );
    expect(await page.evaluate((key) => localStorage.getItem(key), AT_REST_SALT_KEY)).not.toBeNull();

    // …and the library itself is unchanged and readable while unlocked.
    await navClick(page, /library/i);
    await expect(page.getByText(MARKER_NAME).first()).toBeVisible();

    await expectNoPlaintextAnywhere(page);
  });

  test('lock survives a reload behind the unlock gate and reopens the same library', async ({
    page,
  }) => {
    const logs = await watchBrowserLogs(page);
    await openWorkspace(page);
    await createMarkerNote(page);
    await openSettings(page);
    await enableEncryption(page);
    await expectPassphrasesNeverLogged(logs);
    await lockWorkspace(page);

    // The locked workspace holds no corpus: the gate is the only way in.
    await page.reload();
    await waitForAppReady(page);
    await expect(lockGate(page)).toBeVisible();
    // Not an empty workspace behind it — the library is genuinely not loaded.
    await expect(page.getByText(MARKER_NAME)).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), AT_REST_ENCRYPTION_FLAG_KEY)).toBe(
      '1',
    );

    // A reload must not have introduced a plaintext copy either.
    await expectNoPlaintextAnywhere(page);
    await expectPassphrasesNeverLogged(logs);

    await submitPassphrase(page, PASSPHRASE);
    await expect(lockGate(page)).toBeHidden({ timeout: 30_000 });
    await navClick(page, /library/i);
    await expect(page.getByText(MARKER_NAME).first()).toBeVisible();

    // Still ciphertext after the unlock-triggered rehydrate persisted state.
    expect((await readStoredRecord(page))?.format).toBe(ENVELOPE_FORMAT);
    await expectNoPlaintextAnywhere(page);
    await expectPassphrasesNeverLogged(logs);
  });

  /**
   * The shadow run: the app's own seed library is the corpus.
   *
   * Read it while it is still plaintext, seal it, lock, reload, unlock, then
   * prove every note is still there by name and that a note's text is intact.
   * This is the browser equivalent of the fingerprint parity the enable path
   * already checks in code (`at-rest-workspace.ts` refuses to finish if the
   * corpus fingerprint changes while encrypting).
   */
  test('keeps the whole seed corpus intact across the encryption round trip', async ({ page }) => {
    const logs = await watchBrowserLogs(page);
    await openWorkspace(page);
    // A fresh profile persists nothing until the store changes, so save one note
    // first; that materialises the app's own seed library as the baseline.
    await createMarkerNote(page);
    await expect
      .poll(async () => (await readStoredState(page))?.entities?.length ?? 0)
      .toBeGreaterThan(5);
    const plaintext = await readStoredState(page);
    const entities = plaintext?.entities ?? [];
    expect(entities.length).toBeGreaterThan(5);

    await openSettings(page);
    await enableEncryption(page);
    await expectPassphrasesNeverLogged(logs);
    await lockWorkspace(page);
    await page.reload();
    await waitForAppReady(page);
    await submitPassphrase(page, PASSPHRASE);
    await expect(lockGate(page)).toBeHidden({ timeout: 30_000 });

    // Every note is still listed under its own name…
    await navClick(page, /library/i);
    const search = page.getByLabel('Search library');
    for (const entity of entities) {
      await search.fill(entity.name);
      await expect(page.getByText(entity.name, { exact: true }).first()).toBeVisible();
    }
    await search.fill('');

    // …and its text is readable, not just its title.
    // The longest note in the corpus is the strongest single text check.
    const sample = entities.reduce((longest, entity) =>
      entity.content.length > longest.content.length ? entity : longest,
    );
    await expect(sample.content.length).toBeGreaterThan(100);
    await search.fill(sample.name);
    await page.getByRole('button', { name: new RegExp(sample.name.slice(0, 20)) }).first().click();
    await expect(page.locator('#entity-name')).toHaveValue(sample.name);
    const content = page.getByLabel('Editor content', { exact: true });
    await content.waitFor({ state: 'visible', timeout: 30_000 });
    expect(await content.inputValue()).toContain(sample.content.slice(0, 60));

    // Still ciphertext after reading it back.
    expect((await readStoredRecord(page))?.format).toBe(ENVELOPE_FORMAT);
    await expectNoPlaintextAnywhere(page);
    await expectPassphrasesNeverLogged(logs);
  });

  test('refuses a wrong passphrase without opening or changing the workspace', async ({ page }) => {
    const logs = await watchBrowserLogs(page);
    await openWorkspace(page);
    await createMarkerNote(page);
    await openSettings(page);
    await enableEncryption(page);
    await expectPassphrasesNeverLogged(logs);
    await lockWorkspace(page);
    await page.reload();
    await waitForAppReady(page);
    await expect(lockGate(page)).toBeVisible();

    const before = JSON.stringify(await readCanonicalDatabase(page));

    await submitPassphrase(page, WRONG_PASSPHRASE);

    await expect(lockGate(page).getByRole('alert')).toContainText(/does not open this workspace/i);
    await expect(lockGate(page)).toBeVisible();
    await expect(page.getByText(MARKER_NAME)).toHaveCount(0);
    // Fail closed: the ciphertext was neither decrypted nor overwritten.
    expect(JSON.stringify(await readCanonicalDatabase(page))).toBe(before);
    // A refused passphrase must not reach the console either.
    await expectPassphrasesNeverLogged(logs);

    // …and the correct passphrase still opens it, so the refusal is specific.
    await submitPassphrase(page, PASSPHRASE);
    await expect(lockGate(page)).toBeHidden({ timeout: 30_000 });
    await navClick(page, /library/i);
    await expect(page.getByText(MARKER_NAME).first()).toBeVisible();
    await expectPassphrasesNeverLogged(logs);
  });
});
