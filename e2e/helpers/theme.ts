import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openNavIfHidden } from './navigation';

const THEME_STATES = ['light', 'dark', 'system'] as const;
type ThemeState = (typeof THEME_STATES)[number];
type StudioTheme = Exclude<ThemeState, 'system'>;

const NEXT_THEME = {
  light: 'dark',
  dark: 'system',
  system: 'light',
} satisfies Record<ThemeState, ThemeState>;

const CURRENT_THEME_FOR_SWITCH = {
  light: 'system',
  dark: 'light',
  system: 'dark',
} satisfies Record<ThemeState, ThemeState>;

const currentThemeFromLabel = (label: string | null): ThemeState => {
  const switchTarget = THEME_STATES.find((theme) => label?.includes(`Switch to ${theme} theme`));
  if (switchTarget === undefined) {
    throw new Error(`Theme control exposes an unknown accessible label: ${label ?? 'none'}`);
  }
  return CURRENT_THEME_FOR_SWITCH[switchTarget];
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

    const nextTheme = NEXT_THEME[currentTheme];
    await themeButton.press('Enter');
    await expect(themeButton).toHaveAccessibleName(new RegExp(`Switch to ${NEXT_THEME[nextTheme]} theme`));
  }

  throw new Error(`Could not switch the studio to the ${target} theme.`);
};
