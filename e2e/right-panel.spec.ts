import { expect, test } from '@playwright/test'
import { waitForAppReady } from './helpers/navigation'

// Matches `--breakpoint-wide` in src/app/globals.css. Below it the right panel is
// `hidden wide:flex`, so its close control is intentionally absent and the sidebar
// toggle is the only way to reach the panel.
const WIDE_BREAKPOINT_PX = 1100

test.describe('Right panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // The panel and its close control are server-rendered; a click before
    // hydration is lost (plans/149 §5.2).
    await waitForAppReady(page)
  })

  test('close control dismisses Search and exposes the panel toggle', async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < WIDE_BREAKPOINT_PX,
      'Right panel only renders at the wide breakpoint',
    )

    const closePanelButton = page.getByRole('button', { name: 'Close panel' })

    await expect(closePanelButton).toBeVisible()
    await closePanelButton.click()

    await expect(closePanelButton).toBeHidden()
    await expect(page.getByRole('button', { name: 'Show panel' })).toBeVisible()
  })
})
