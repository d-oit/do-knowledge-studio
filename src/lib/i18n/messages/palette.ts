/**
 * Command palette i18n messages (N5).
 *
 * User-facing strings for `command-palette.tsx`: nav item labels, group
 * headings, the search placeholder, and footer hints.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible name of the command palette overlay. */
  'palette.ariaLabel': 'Command palette',
  /** Search input placeholder. */
  'palette.inputPlaceholder': 'Search commands and entities…',
  /** Empty results state. */
  'palette.empty': 'No matches.',
  /** Navigation group heading. */
  'palette.group.navigate': 'Navigate',
  /** Create group heading. */
  'palette.group.create': 'Create',
  /** Library group heading. */
  'palette.group.library': 'Library',
  /** Nav item: home view. */
  'palette.nav.home': 'Home',
  /** Nav item: editor view. */
  'palette.nav.editor': 'Editor',
  /** Nav item: library view. */
  'palette.nav.library': 'Library',
  /** Nav item: graph view. */
  'palette.nav.graph': 'Graph',
  /** Nav item: mind map view. */
  'palette.nav.mindmap': 'Mind Map',
  /** Nav item: chat view. */
  'palette.nav.chat': 'Chat',
  /** Nav item: AI harness view. */
  'palette.nav.ai': 'AI Harness',
  /** Nav item: TRIZ matrix view. */
  'palette.nav.triz': 'TRIZ Matrix',
  /** Nav item: export view. */
  'palette.nav.export': 'Export',
  /** Create action label. */
  'palette.create.label': 'Create new entity',
  /** Create action hint. */
  'palette.create.hint': 'Opens the Editor',
  /** Footer keyboard hints line. */
  'palette.footer.hints': '↑↓ navigate · ↵ select · esc close',
  /** Footer result count; count interpolated. */
  'palette.footer.results': (count: string) => `${count} results`,
} as const

/** Typed `translate` helper bound to the command palette message scope. */
export const translate = makeT(messages)