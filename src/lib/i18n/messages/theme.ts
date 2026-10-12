/**
 * Theme i18n messages.
 *
 * User-facing strings for theme toggle controls (sidebar, mobile drawer).
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Light theme label. */
  'theme.light': 'Light',
  /** Dark theme label. */
  'theme.dark': 'Dark',
  /** System theme label. */
  'theme.system': 'System',
  /** Accessible label for theme button when switching to light. */
  'theme.switchToLight': 'Switch to light theme',
  /** Accessible label for theme button when switching to dark. */
  'theme.switchToDark': 'Switch to dark theme',
  /** Accessible label for theme button when switching to system. */
  'theme.switchToSystem': 'Switch to system theme',
  /** Accessible label for theme button showing current theme and action. */
  'theme.toggleAria': (current: string) => `Toggle theme (current: ${current})`,
} as const

/** Typed `translate` helper bound to the theme message scope. */
export const translate = makeT(messages)
