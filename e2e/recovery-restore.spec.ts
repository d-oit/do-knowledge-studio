import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady, navClick } from './helpers/navigation';

/**
 * Pre-import backup and restore (Plan 162 #1).
 *
 * A JSON import replaces the entire library. The pre-import snapshot is the
 * only thing standing between that and unrecoverable loss, so both halves of
 * that contract are pinned here against the real app:
 *
 *  - a normal import leaves a restorable snapshot, reachable from any view
 *  - restoring actually puts the replaced corpus back
 *  - dismissing the offer never destroys the snapshot
 *  - an import too large to snapshot says so instead of claiming a clean swap
 */

const STORE_KEY = 'do-knowledge-studio-store';
const RECOVERY_KEY = 'do-knowledge-studio-recovery';

const entityNames = (page: Page): Promise<string[]> =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('state' in parsed)) return [];
    const state: unknown = parsed.state;
    if (typeof state !== 'object' || state === null || !('entities' in state)) return [];
    const entities: unknown = state.entities;
    if (!Array.isArray(entities)) return [];
    return entities
      .filter((e): e is { name: string } =>
        typeof e === 'object' && e !== null && 'name' in e && typeof e.name === 'string',
      )
      .map((e) => e.name);
  }, STORE_KEY);

const hasSnapshot = (page: Page): Promise<boolean> =>
  page.evaluate((key) => localStorage.getItem(key) !== null, RECOVERY_KEY);

/** Drives the Export view's file → preview → confirm import flow. */
const importJson = async (page: Page, fixture: string): Promise<void> => {
  await navClick(page, /^export/i);
  await page.locator('input[type=file]').setInputFiles(fixture);
  // Exact label: a loose `/import/` match also hits the "Import knowledge"
  // heading region, so the click lands on nothing and the test times out
  // believing the app did nothing.
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
};

/** Builds an export-shaped JSON fixture in a temp dir and returns its path. */
const writeFixture = async (
  name: string,
  entity: { id: string; name: string; content?: string },
): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'dks-recovery-'));
  const path = join(dir, `${name}.json`);
  const base = {
    id: entity.id,
    name: entity.name,
    type: 'concept',
    description: '',
    content: entity.content ?? '',
    tags: [],
    links: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  await writeFile(
    path,
    JSON.stringify({ version: 1, exportedAt: '2026-01-01T00:00:00.000Z', entities: [base], claims: [] }),
  );
  return path;
};

/**
 * Creates one entity through the UI and returns the persisted corpus.
 *
 * The store writes its persisted blob on the first mutation, not on mount: a
 * fresh profile reads back an empty key until something changes. Seeding a real
 * entity through the UI is also the honest way to establish corpus A, since it
 * exercises the same write path a user does rather than poking storage.
 */
const seedCorpusA = async (page: Page): Promise<string[]> => {
  await page.getByRole('button', { name: /new entity/i }).first().click();
  await page.getByLabel(/name/i).first().fill('Sentinel Entity');
  await page.getByRole('button', { name: /save|commit/i }).first().click();
  await expect.poll(() => entityNames(page).then((n) => n.includes('Sentinel Entity'))).toBe(true);
  return entityNames(page);
};

/**
 * Establishes a corpus A whose *snapshot* exceeds the 4 MiB guard while the
 * store itself stays inside the browser's quota.
 *
 * Done with one import of a padded corpus rather than by growing the library
 * through the editor: the snapshot carries the whole undo history, and an import
 * seeds that history with the corpus, so a single ~2.2 MB import produces a
 * ~4.4 MB snapshot. The earlier editor-driven version was both slow enough to
 * time out on the mobile and tablet projects and coupled to editor form state.
 *
 * Importing is also the more faithful reproduction: this is the state a user
 * with a real library reaches, and it is the state the guard was written for.
 */
const seedLargeCorpusA = async (page: Page): Promise<string[]> => {
  const fixture = await writeFixture('corpus-a-large', {
    id: 'corpus-a-large-1',
    name: 'Corpus A Large',
    content: 'x'.repeat(2_200_000),
  });
  await importJson(page, fixture);
  await expect.poll(() => entityNames(page)).toEqual(['Corpus A Large']);
  return entityNames(page);
};

test.describe('pre-import backup and restore', () => {
  test('a normal import leaves a restore offer that brings the old library back', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const before = await seedCorpusA(page);

    const fixture = await writeFixture('corpus-b', { id: 'corpus-b-1', name: 'Corpus B Alpha' });
    await importJson(page, fixture);

    // The import really replaced the library.
    await expect.poll(() => entityNames(page)).toEqual(['Corpus B Alpha']);
    expect(await hasSnapshot(page)).toBe(true);

    // The offer is reachable without returning to the view the import ran in.
    const banner = page.getByTestId('recovery-banner');
    // The offer names the snapshot's own contents, which are corpus A. Derived
    // rather than hardcoded, and boundary-anchored with the correct plural, so
    // neither a seed-data change nor a digit-suffix collision can pass or fail
    // this for the wrong reason.
    const entityNoun = before.length === 1 ? 'entity' : 'entities';
    await expect(banner).toContainText(new RegExp(`\\b${before.length} ${entityNoun}\\b`));

    // Navigate away; the offer must not be trapped in the Export view.
    await navClick(page, /^home/i);
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: /restore it/i }).click();

    // The replaced corpus is back, and the snapshot is consumed.
    await expect.poll(() => entityNames(page)).toEqual(before);
    await expect(banner).toHaveCount(0);
    expect(await hasSnapshot(page)).toBe(false);
  });

  test('dismissing the restore offer does not destroy the snapshot', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const before = await seedCorpusA(page);
    const fixture = await writeFixture('corpus-c', { id: 'corpus-c-1', name: 'Corpus C Alpha' });
    await importJson(page, fixture);

    const banner = page.getByTestId('recovery-banner');
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: /hide for this page session/i }).click();
    await expect(banner).toHaveCount(0);

    // Hiding is not deleting: the bytes survive, so a reload offers it again.
    expect(await hasSnapshot(page)).toBe(true);
    await page.reload();
    await waitForAppReady(page);
    await expect(page.getByTestId('recovery-banner')).toBeVisible();

    // And the snapshot still restores the right corpus.
    await page.getByRole('button', { name: /restore it/i }).click();
    await expect.poll(() => entityNames(page)).toEqual(before);
  });

  test('a corpus too large to snapshot does not claim a clean swap', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // A corpus A small enough for the browser's own localStorage quota but
    // whose *snapshot* exceeds the 4 MiB guard.
    //
    // The snapshot carries the whole undo history, so it serializes larger than
    // the persisted store. That gap is the real shape of this bug. An import of
    // several megabytes — the obvious way to trigger it — instead blows the
    // browser quota, rolls back, and never reaches the backup code at all:
    // that is a different, already-reported failure and would test nothing.
    await seedLargeCorpusA(page);

    const fixture = await writeFixture('replacement', { id: 'new-1', name: 'Replacement Corpus' });
    await importJson(page, fixture);

    // The import genuinely succeeded — only the safety net is missing, which is
    // exactly what the warning claims. A skipped backup must never be conflated
    // with a failed import.
    await expect.poll(() => entityNames(page)).toEqual(['Replacement Corpus']);
    await expect(page.getByText(/no backup was kept/i)).toBeVisible();
    await expect(page.getByText(/too large for this browser/i)).toBeVisible();
    // ...and it does not leave a stale snapshot that would restore the wrong
    // corpus, and it does not offer a restore it cannot honour.
    expect(await hasSnapshot(page)).toBe(false);
    await expect(page.getByTestId('recovery-banner')).toHaveCount(0);
  });
});