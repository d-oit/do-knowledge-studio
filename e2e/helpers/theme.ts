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
