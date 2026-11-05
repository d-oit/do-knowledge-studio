import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import { waitForAppReady, navClick } from './helpers/navigation';
import { readStoredState } from './helpers/store';

/**
 * Markdown / vault import (issue #1054).
 *
 * A vault `.zip` dropped on the Export view parses into entities with
 * resolved links, stages stubs and conflicts in the preview, commits through
 * the same rollback-guarded path as every other import, and leaves a
 * restorable snapshot. Oversize input fails closed with no partial state.
 */

const FIXTURE_ROOT = join(process.cwd(), 'src', 'lib', 'import', 'fixtures', 'vault');

/** Temp directories holding generated fixtures; removed after the run. */
const fixtureDirs: string[] = [];

/** Recursively reads the fixture vault into zip entries. */
const readVaultEntries = async (dir: string, prefix: string, entries: Record<string, Uint8Array>): Promise<void> => {
  const dirents = await readdir(dir, { withFileTypes: true });
  for (const name of dirents) {
    if (name.name.startsWith('.')) continue;
    if (name.isDirectory()) {
      await readVaultEntries(join(dir, name.name), `${prefix}${name.name}/`, entries);
    } else {
      entries[`${prefix}${name.name}`] = strToU8(await readFile(join(dir, name.name), 'utf8'));
    }
  }
};

/** Zips the fixture vault into a temp file and returns its path. */
const writeVaultZip = async (): Promise<string> => {
  const entries: Record<string, Uint8Array> = {};
  await readVaultEntries(FIXTURE_ROOT, '', entries);
  const dir = await mkdtemp(join(tmpdir(), 'dks-vault-'));
  fixtureDirs.push(dir);
  const path = join(dir, 'vault.zip');
  await writeFile(path, zipSync(entries));
  return path;
};

/** Writes a single oversized Markdown note and returns its path. */
const writeOversizedNote = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'dks-oversize-'));
  fixtureDirs.push(dir);
  const path = join(dir, 'big.md');
  await writeFile(path, `# Big\n\n${'x'.repeat(1_200_000)}\n`);
  return path;
};

const entityNames = async (page: Page): Promise<string[]> => {
  const state = await readStoredState(page);
  return (state?.entities ?? []).map((entity) => entity.name);
};

/**
 * Creates one entity through the UI so the persisted baseline exists before
 * the test acts. The store writes its persisted blob on the first mutation,
 * not on mount, so reading beforehand yields a pre-hydration empty result.
 */
const seedSentinel = async (page: Page): Promise<string[]> => {
  await page.getByRole('button', { name: /new entity/i }).first().click();
  await page.getByLabel(/name/i).first().fill('Sentinel Entity');
  await page.getByRole('button', { name: /save|commit/i }).first().click();
  await expect.poll(() => entityNames(page).then((n) => n.includes('Sentinel Entity'))).toBe(true);
  return entityNames(page);
};

test.describe('markdown and vault import', () => {
  test.afterAll(async () => {
    await Promise.all(fixtureDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    fixtureDirs.length = 0;
  });

  test('a vault zip previews stubs and conflicts, imports, and restores', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    const before = await seedSentinel(page);

    const zip = await writeVaultZip();
    await navClick(page, /^export/i);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'vault.zip',
      mimeType: 'application/zip',
      buffer: await readFile(zip),
    });

    // The preview stages counts, stub names, and the duplicate-name conflict.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Import preview');
    await expect(dialog).toContainText(/stub entit/);
    await expect(dialog).toContainText('Missing Link');
    await expect(dialog).toContainText(/duplicate names?/);
    await expect(dialog).toContainText('Shared Name');
    await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();

    // The library holds the vault notes plus minted stubs.
    await expect.poll(() => entityNames(page)).toContain('Alpha Project');
    await expect.poll(() => entityNames(page)).toContain('Missing Link');
    expect(await entityNames(page)).toContain('café');

    // The same pre-import snapshot path as every other import restores it.
    const banner = page.getByTestId('recovery-banner');
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: /restore it/i }).click();
    await expect(page.getByText('Restore Pre-Import Snapshot?')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Restore it', exact: true }).click();
    await expect.poll(() => entityNames(page)).toEqual(before);
  });

  test('an oversized note fails closed with no partial state', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    const before = await seedSentinel(page);

    const big = await writeOversizedNote();
    await navClick(page, /^export/i);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'big.md',
      mimeType: 'text/markdown',
      buffer: await readFile(big),
    });

    await expect(page.getByText('Import failed')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await entityNames(page)).toEqual(before);
  });
});
