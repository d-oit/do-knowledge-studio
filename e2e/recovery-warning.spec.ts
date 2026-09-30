import { test, expect } from '@playwright/test';
import { navClick, waitForAppReady } from './helpers/navigation';

/**
 * A refused persistence envelope must be visible on FIRST load, from any view.
 *
 * The banner used to be mounted only in the lazy Export view, so a user whose
 * library failed to hydrate landed on Home looking at the demo seed set with no
 * indication that their data existed at all. These tests pin the visibility
 * contract, not the styling: warning present, no navigation required, survives
 * a reload, and no dismissal can delete the preserved bytes.
 */

const STORE_KEY = 'do-knowledge-studio-store';
const QUARANTINE_KEY = 'do-knowledge-studio-quarantine';

/** A distinctive entity id so a hydrated store is distinguishable from seed. */
const MARKER_ID = 'rejected-library-marker-entity';

const FUTURE_ENVELOPE = {
  state: {
    entities: [
      {
        id: MARKER_ID,
        name: 'Recovered From A Newer Build',
        type: 'note',
        description: 'Written by a newer build than this one understands.',
        content: 'Payload a future version of the studio wrote.',
        tags: ['recovery'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        links: [],
      },
    ],
    claims: [],
  },
  version: 99,
};

const RAW = JSON.stringify(FUTURE_ENVELOPE);

test.describe('Refused library recovery warning', () => {
  test.beforeEach(async ({ page }) => {
    // Seeded before any app script runs, so the store hydrates against a
    // future-version envelope exactly as it would after a real downgrade.
    await page.addInitScript(
      ({ storeKey, envelope }) => {
        localStorage.setItem(storeKey, JSON.stringify(envelope));
      },
      { storeKey: STORE_KEY, envelope: FUTURE_ENVELOPE },
    );
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('warns on Home without navigating to Export', async ({ page }) => {
    const alert = page.getByTestId('quarantine-banner');
    await expect(alert).toBeVisible();
    // The refused payload was never hydrated, so the marker entity must not be
    // presented as if it loaded.
    await expect(alert).toContainText(/could not be loaded/i);
  });

  test('keeps the refused bytes in the live store key', async ({ page }) => {
    // The temporary workspace must not overwrite what it refused to load.
    const stored = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
    expect(stored).toBe(RAW);
  });

  test('offers a download whose bytes equal the refused envelope', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download copy/i }).click();
    const download = await downloadPromise;

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bytes = Buffer.concat(chunks).toString('utf8');

    // Not merely "an anchor was clicked": the file is the forensic backup.
    expect(bytes).toBe(RAW);
  });

  test('hiding the warning for the page session keeps the copy on disk', async ({ page }) => {
    const quarantineBefore = await page.evaluate((key) => localStorage.getItem(key), QUARANTINE_KEY);
    expect(quarantineBefore).not.toBeNull();

    await page.getByRole('button', { name: /hide .*this page session/i }).click();
    await expect(page.getByTestId('quarantine-banner')).toBeHidden();

    // Dismissal is not deletion: the only copy of the refused payload survives.
    const quarantineAfter = await page.evaluate((key) => localStorage.getItem(key), QUARANTINE_KEY);
    expect(quarantineAfter).toBe(quarantineBefore);
  });

  test('the warning returns after a reload', async ({ page }) => {
    await page.getByRole('button', { name: /hide .*this page session/i }).click();
    await expect(page.getByTestId('quarantine-banner')).toBeHidden();

    await page.reload();
    await waitForAppReady(page);
    // Hiding is per page session, not a decision about the data.
    await expect(page.getByTestId('quarantine-banner')).toBeVisible();
  });

  test('stays visible after navigating to another view', async ({ page }) => {
    await navClick(page, /library/i);
    await expect(page.getByTestId('quarantine-banner')).toBeVisible();
  });

  test('an edit in the refused tab does not change the stored bytes', async ({ page }) => {
    await navClick(page, /editor/i);
    await page.locator('#entity-name').fill('Edit made on a refused workspace');
    await page.getByRole('button', { name: 'Save to library' }).click();

    // Editing stays possible (the workspace is usable) but is not persisted,
    // so the refused payload cannot be replaced by it.
    const stored = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
    expect(stored).toBe(RAW);
  });

  test('blocks the sync view while the refusal is unresolved', async ({ page }) => {
    await navClick(page, /sync/i);
    // Publishing this temporary workspace would overwrite a healthy tab, so
    // the room controls SyncView offers are never rendered.
    await expect(page.getByTestId('sync-unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: /join room/i })).toHaveCount(0);
    await expect(page.getByPlaceholder(/room id/i)).toHaveCount(0);
  });


  test('exposes the warning as an alert with a 44px hide target', async ({ page }) => {
    const alert = page.getByRole('alert');
    await expect(alert.first()).toBeVisible();
    const hide = page.getByRole('button', { name: /hide .*this page session/i });
    await expect(hide).toBeVisible();
    const box = await hide.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
