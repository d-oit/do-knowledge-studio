/**
 * Navigation i18n messages (#865).
 *
 * Single source for the labels, titles, subtitles and group headings shown by
 * the three navigation surfaces — the desktop sidebar, the topbar, and the
 * mobile drawer. Before this scope the same eleven view labels were duplicated
 * in three parallel hardcoded maps (`app-shell.tsx` `VIEW_NAMES`,
 * `topbar.tsx` `VIEW_TITLES`, `sidebar.tsx` `NAV_GROUPS`), so renaming a view
 * created three bugs and one stale aria-label.
 *
 * The Timeline view keeps its own `timeline.*` scope (owned by the timeline
 * workstream); `src/lib/studio/view-meta.ts` composes both into the single
 * `VIEW_META` table the components consume.
 */

import { makeT } from '@/lib/i18n/t'

const messages = {
  /* ── Sidebar group headings ─────────────────────────────────────── */
  'nav.group.overview': 'Overview',
  'nav.group.capture': 'Capture',
  'nav.group.explore': 'Explore',
  'nav.group.ask': 'Ask',
  'nav.group.lab': 'Lab',
  'nav.group.data': 'Data',

  /* ── View labels (sidebar nav, shortcut hints, error boundaries) ─── */
  'nav.label.home': 'Home',
  'nav.label.editor': 'Editor',
  'nav.label.library': 'Library',
  'nav.label.graph': 'Graph',
  'nav.label.mindmap': 'Mind Map',
  'nav.label.chat': 'Chat',
  'nav.label.ai': 'AI Harness',
  'nav.label.triz': 'TRIZ Matrix',
  'nav.label.export': 'Export',
  'nav.label.sync': 'Sync',

  /* ── View titles (topbar H1) ────────────────────────────────────── */
  'nav.title.home': 'Studio',
  'nav.title.editor': 'Editor',
  'nav.title.library': 'Library',
  'nav.title.graph': 'Graph',
  'nav.title.mindmap': 'Mind Map',
  'nav.title.chat': 'Chat',
  'nav.title.ai': 'AI Harness',
  'nav.title.triz': 'TRIZ Matrix',
  'nav.title.export': 'Export',
  'nav.title.sync': 'Sync',

  /* ── View subtitles (topbar) ────────────────────────────────────── */
  'nav.subtitle.home': 'Your knowledge base at a glance',
  'nav.subtitle.editor': 'Capture a thought, claim, or note',
  'nav.subtitle.library': 'Browse and filter your entities',
  'nav.subtitle.graph': 'Visualize relationships',
  'nav.subtitle.mindmap': 'Hierarchical exploration',
  'nav.subtitle.chat': 'Ask your library',
  'nav.subtitle.ai': 'Configure and chat with LLMs',
  'nav.subtitle.triz': 'Solve inventive contradictions',
  'nav.subtitle.export': 'Backup and share your knowledge',
  'nav.subtitle.sync': 'Connect devices and sync peer-to-peer',
} as const

/** Typed `translate` helper bound to the navigation message scope. */
export const translate = makeT(messages)
