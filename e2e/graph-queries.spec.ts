import { test, expect } from '@playwright/test'
import { navClick } from './helpers/navigation'

/**
 * Graph queries (#1058): path finding, filters, and saved views.
 *
 * The seed corpus links `TRIZ Contradiction Matrix` (e1) to
 * `Genrich Altshuller` (e2) with the relation `developed by`, which gives the
 * suite a deterministic one-hop path without creating data first.
 */
test.describe('Graph queries', () => {
  test('finds a path, filters the canvas, and restores a saved view after reload', async ({
    page,
  }) => {
    await page.goto('/')
    await navClick(page, /graph/i)

    await page.getByRole('button', { name: /^queries$/i }).click()
    await expect(page.getByRole('heading', { name: /graph queries/i })).toBeVisible()

    // --- Shortest path -------------------------------------------------------
    await page.getByLabel('From', { exact: true }).selectOption({ label: 'TRIZ Contradiction Matrix' })
    await page.getByLabel('To', { exact: true }).selectOption({ label: 'Genrich Altshuller' })
    await page.getByRole('button', { name: /find path/i }).click()

    await expect(page.getByText(/1 hop\(s\) in the shortest path/i)).toBeVisible()
    await expect(page.getByText('1. developed by')).toBeVisible()
    await expect(page.getByText(/TRIZ Contradiction Matrix → Genrich Altshuller/)).toBeVisible()
    // The highlight is additive: the result is also a list, and both endpoints
    // announce themselves as on the path for screen-reader users.
    await expect(
      page.getByRole('button', { name: /TRIZ Contradiction Matrix.*on path/ }),
    ).toBeVisible()

    // --- Filter --------------------------------------------------------------
    await page.getByRole('checkbox', { name: 'Person' }).check()
    // Only the single seeded person survives a Person-only filter.
    await expect(page.getByText(/1 nodes/)).toBeVisible()

    // --- Saved view + reload -------------------------------------------------
    await page.getByLabel(/view name/i).fill('People only')
    await page.getByRole('button', { name: /save view/i }).click()
    await expect(page.getByText('People only')).toBeVisible()

    await page.reload()
    await navClick(page, /graph/i)
    await page.getByRole('button', { name: /^queries$/i }).click()
    await expect(page.getByText('People only')).toBeVisible()

    // Filters are view state, not corpus data: a reload starts unfiltered, so
    // Apply is what has to bring the narrowed canvas back.
    await expect(page.getByText(/1 nodes/)).toBeHidden()

    await page.getByRole('button', { name: /^apply$/i }).click()
    await expect(page.getByText(/1 nodes/)).toBeVisible()
  })
})
