import { test, expect, type Page } from '@playwright/test'
import { navClick } from './helpers/navigation'

/**
 * Visual nested query builder (#1164): composition, live preview, validation,
 * persistence through saved views, and keyboard/screen-reader operation.
 *
 * The seed corpus has exactly one `person` (e2), so a person condition is a
 * deterministic filter: 1 of 8 entities, 0 edges (e2's only link points at a
 * concept).
 */

test.describe('Visual query builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await navClick(page, /graph/i)
    await page.getByRole('button', { name: /^queries$/i }).click()
    await expect(page.getByRole('heading', { name: /graph queries/i })).toBeVisible()
  })

  const builder = (page: Page) => page.getByRole('region', { name: 'Visual query builder' })

  const canvasEntityCount = async (page: Page): Promise<number> => {
    const label = await page.locator('svg[aria-label^="Knowledge graph"]').getAttribute('aria-label')
    const match = /with (\d+) entities/.exec(label ?? '')
    const count = Number(match?.[1] ?? Number.NaN)
    expect(Number.isFinite(count)).toBe(true)
    return count
  }

  test('composes a condition, previews live, and the canvas mirrors it', async ({ page }) => {
    const b = builder(page)
    await expect(b.getByRole('status')).toHaveText('8 of 8 entities and 12 edges match.')

    await b.getByRole('button', { name: /add condition/i }).click()
    await b.getByLabel('Entity type', { exact: true }).selectOption({ label: 'Person' })

    // The preview and the renderer share the evaluator: the canvas now shows
    // exactly the one person entity.
    await expect(b.getByRole('status')).toHaveText('1 of 8 entities and 0 edges match.')
    await expect(b.getByText(/Query: type:person/)).toBeVisible()
    await expect.poll(() => canvasEntityCount(page)).toBe(1)
  })

  test('nested AND/OR groups evaluate against the corpus', async ({ page }) => {
    const b = builder(page)

    // OR(tag:triz, type:person) → e1, e2, e3 (3 of 8).
    await b.getByRole('button', { name: /add group/i }).click()
    const group = b.getByRole('group', { name: 'Group' }).first()
    await group.getByLabel('Group', { exact: true }).selectOption({ label: 'OR' })
    await group.getByRole('button', { name: /add condition/i }).click()
    await group.getByLabel('Condition', { exact: true }).selectOption({ label: 'Tag' })
    await group.getByLabel('Tag', { exact: true }).fill('triz')
    await group.getByRole('button', { name: /add condition/i }).click()
    await group.getByLabel('Entity type', { exact: true }).selectOption({ label: 'Person' })

    await expect(b.getByRole('status')).toHaveText('3 of 8 entities and 4 edges match.')
    await expect.poll(() => canvasEntityCount(page)).toBe(3)
  })

  test('invalid empty groups fail visibly without changing the canvas', async ({ page }) => {
    const b = builder(page)
    await b.getByRole('button', { name: /add group/i }).click()

    const alert = b.getByRole('alert')
    await expect(alert).toContainText('An empty group matches nothing')
    await expect(b.getByRole('status')).toHaveText(
      'This query has issues and is not applied to the canvas.',
    )
    // The canvas keeps the full, unfiltered graph.
    await expect.poll(() => canvasEntityCount(page)).toBe(8)
  })

  test('saves a query view, restores it after reload, and applies it', async ({ page }) => {
    const b = builder(page)
    await b.getByRole('button', { name: /add condition/i }).click()
    await b.getByLabel('Entity type', { exact: true }).selectOption({ label: 'Person' })
    await expect(b.getByRole('status')).toHaveText('1 of 8 entities and 0 edges match.')

    await page.getByLabel(/view name/i).fill('People query')
    await page.getByRole('button', { name: /save view/i }).click()
    await expect(page.getByText('People query')).toBeVisible()

    await page.reload()
    await navClick(page, /graph/i)
    await page.getByRole('button', { name: /^queries$/i }).click()
    await expect(page.getByText('People query')).toBeVisible()

    // A reload starts unfiltered; only Apply brings the query back.
    await expect.poll(() => canvasEntityCount(page)).toBe(8)
    await page.getByRole('button', { name: /^apply$/i }).click()
    await expect.poll(() => canvasEntityCount(page)).toBe(1)
    await expect(b.getByRole('status')).toHaveText('1 of 8 entities and 0 edges match.')
  })

  test('renames and duplicates saved query views', async ({ page }) => {
    const b = builder(page)
    await b.getByRole('button', { name: /add condition/i }).click()
    await b.getByLabel('Entity type', { exact: true }).selectOption({ label: 'Person' })
    await page.getByLabel(/view name/i).fill('Original')
    await page.getByRole('button', { name: /save view/i }).click()

    await page.getByRole('button', { name: /rename saved view Original/i }).click()
    const renameInput = page.getByLabel(/rename saved view Original/i)
    await expect(renameInput).toBeVisible()
    await renameInput.fill('Renamed')
    await page.getByRole('button', { name: /save name/i }).click()
    await expect(page.getByText('Renamed')).toBeVisible()

    await page.getByRole('button', { name: /duplicate saved view Renamed/i }).click()
    await expect(page.getByText('Copy of Renamed')).toBeVisible()
  })

  test('operates by keyboard and exposes screen-reader semantics', async ({ page }) => {
    const b = builder(page)

    // Enter on a focused native button activates it in a real browser.
    const addButton = b.getByRole('button', { name: /add condition/i })
    await addButton.focus()
    await page.keyboard.press('Enter')
    await expect(b.getByLabel('Entity type', { exact: true })).toBeVisible()

    await b.getByLabel('Entity type', { exact: true }).selectOption({ label: 'Person' })

    // Space toggles the focused Exclude checkbox — a genuine keyboard path.
    const excludeCheckbox = b.getByRole('checkbox', { name: 'Exclude' })
    await excludeCheckbox.focus()
    await page.keyboard.press('Space')
    await expect(b.getByText(/Query: NOT type:person/)).toBeVisible()

    // Screen-reader semantics: live status region, alert for validation, and
    // list semantics for the clause tree.
    await expect(b.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    await b.getByRole('button', { name: /add group/i }).click()
    await expect(b.getByRole('alert')).toBeVisible()
  })
})
