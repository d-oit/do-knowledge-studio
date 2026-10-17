import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openNavIfHidden } from './navigation';

const THEME_STATES = ['light', 'dark', 'system'] as const;
type ThemeState = (typeof THEME_STATES)[number];
type StudioTheme = Exclude<ThemeState, 'system'>;

const nextThemeState = (theme: ThemeState): ThemeState => {
  switch (theme) {
    case 'light':
      return 'dark';
    case 'dark':
      return 'system';
    case 'system':
      return 'light';
  }
};

const currentThemeFromLabel = (label: string | null): ThemeState => {
  const switchTarget = THEME_STATES.find((theme) => label?.includes(`Switch to ${theme} theme`));
  switch (switchTarget) {
    case 'light':
      return 'system';
    case 'dark':
      return 'light';
    case 'system':
      return 'dark';
    case undefined:
      throw new Error(`Theme control exposes an unknown accessible label: ${label ?? 'none'}`);
  }
};

export const setStudioTheme = async (page: Page, target: StudioTheme): Promise<void> => {
  await openNavIfHidden(page);
  const themeButton = page.getByRole('button', { name: /Switch to (light|dark|system) theme/ });
  await expect(themeButton).toBeVisible();

  for (let step = 0; step < THEME_STATES.length; step += 1) {
    const currentTheme = currentThemeFromLabel(await themeButton.getAttribute('aria-label'));
    if (currentTheme === target) {
      const drawer = page.getByRole('dialog').first();
      if (await drawer.isVisible()) {
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
      }
      return;
    }

    const stateAfterPress = nextThemeState(currentTheme);
    const labelAfterPress = nextThemeState(stateAfterPress);
    await themeButton.press('Enter');
    await expect.poll(() => themeButton.getAttribute('aria-label')).toContain(`Switch to ${labelAfterPress} theme`);
  }

  throw new Error(`Could not switch the studio to the ${target} theme.`);
};

/**
 * Palettes the a11y and touch-target specs are exercised in (ADR 036 §Decision,
 * Plan 130 A19).
 */
export const THEME_PASSES = ['light', 'dark'] as const;
export type ThemePass = (typeof THEME_PASSES)[number];

/** Class `next-themes` puts on `<html>`; `globals.css` scopes every dark token to it. */
const DARK_CLASS = 'dark';

/**
 * Asserts the loaded page resolved to `theme`'s palette.
 *
 * Activate the palette with the `colorScheme` test option: one line per themed
 * describe, resolved by the provider from the context's emulated preference, and
 * the same `.dark` token set an explicit dark-mode user gets. Seeding
 * `THEME_STORAGE_KEY` instead would make each pass depend on the theme control's
 * post-mount state rather than on the palette being measured, and it duplicates
 * what `colorScheme` already emulates.
 *
 * Nothing the test writes is what mounts the palette, so this assertion is what
 * keeps a `colorScheme` pass honest: if the provider ever stops resolving the
 * emulated preference (e.g. `defaultTheme` stops being `system`), the pass fails
 * loudly instead of silently measuring the light palette twice.
 */
export const expectThemeApplied = async (page: Page, theme: ThemePass): Promise<void> => {
  const rootElement = page.locator('html');
  if (theme === DARK_CLASS) {
    await expect(rootElement).toHaveClass(/\bdark\b/);
    return;
  }
  await expect(rootElement).toHaveClass(/\blight\b/);
  await expect(rootElement).not.toHaveClass(/\bdark\b/);
};
