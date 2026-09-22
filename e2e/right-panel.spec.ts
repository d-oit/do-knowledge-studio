import { expect, test } from '@playwright/test'

test.describe('Right panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('close control dismisses Search and exposes the panel toggle', async ({ page }) => {
    const closePanelButton = page.getByRole('button', { name: 'Close panel' })

    await expect(closePanelButton).toBeVisible()
    await closePanelButton.click()

    await expect(closePanelButton).toBeHidden()
    await expect(page.getByRole('button', { name: 'Show panel' })).toBeVisible()
  })
})
