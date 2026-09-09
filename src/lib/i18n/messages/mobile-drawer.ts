/**
 * Mobile drawer i18n messages (N5).
 *
 * User-facing strings for `mobile-drawer.tsx`: brand, tab switcher, search
 * tab, and footer (theme toggle, offline badge, entity counts).
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible name of the mobile drawer overlay. */
  'drawer.ariaLabel': 'Navigation and search',
  /** Brand name in the drawer header. */
  'drawer.brand': 'Knowledge Studio',
  /** Accessible label of the release link; version interpolated. */
  'drawer.releaseAriaLabel': (version: string) => `Knowledge Studio v${version} release page`,
  /** Release badge under the brand; version interpolated. */
  'drawer.releaseBadge': (version: string) => `Local-first · v${version}`,
  /** Close button label. */
  'drawer.close': 'Close drawer',
  /** Accessible name of the tab switcher. */
  'drawer.tabsAriaLabel': 'Drawer view',
  /** Navigation tab label. */
  'drawer.tab.navigate': 'Navigate',
  /** Search tab label. */
  'drawer.tab.search': 'Search',
  /** Accessible name of the navigation list. */
  'drawer.navAriaLabel': 'Main navigation',
  /** Badge shown next to experimental navigation items. */
  'drawer.lab': 'Lab',
  /** Search input placeholder. */
  'drawer.search.placeholder': 'Search knowledge base…',
  /** Accessible label of the search input. */
  'drawer.search.ariaLabel': 'Search knowledge base',
  /** Search empty state when a query is present. */
  'drawer.search.empty': 'No matches found.',
  /** Search empty state when the library has no entities. */
  'drawer.search.libraryEmpty': 'Your library is empty.',
  /** Accessible label of the search results list. */
  'drawer.search.resultsAriaLabel': 'Search results',
  /** Offline-readiness badge. */
  'drawer.offlineReady': 'Offline ready',
  /** Entity count footer; count interpolated. */
  'drawer.entityCount': (count: string) => `${count} entities`,
  /** Theme toggle label when switching to light. */
  'drawer.theme.lightAria': 'Switch to light theme',
  /** Theme toggle label when switching to dark. */
  'drawer.theme.darkAria': 'Switch to dark theme',
  /** Light theme action label. */
  'drawer.theme.light': 'Light',
  /** Dark theme action label. */
  'drawer.theme.dark': 'Dark',
  /** Footer local-search summary; count interpolated. */
  'drawer.footer.localSearch': (count: string) => `Local search · ${count} entities`,
} as const

/** Typed `t` helper bound to the mobile drawer message scope. */
export const t = makeT(messages)