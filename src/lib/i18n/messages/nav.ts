/**
 * Navigation i18n messages (issue #865).
 *
 * Single source for the shell's view labels (`VIEW_NAMES` in app-shell.tsx),
 * the topbar titles/subtitles (`VIEW_TITLES`), and the sidebar / mobile drawer
 * section headings (`NAV_GROUPS`). Those three maps previously hardcoded the
 * same view labels in parallel.
 *
 * The Timeline view keeps its entries in `messages/timeline.ts`, which already
 * owns them, so they are not repeated here.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Sidebar and mobile drawer label for the Home view. */
  'nav.home.label': 'Home',
  /** Topbar title for the Home view. */
  'nav.home.title': 'Studio',
  /** Topbar subtitle for the Home view. */
  'nav.home.subtitle': 'Your knowledge base at a glance',
  /** Sidebar and mobile drawer label for the Editor view. */
  'nav.editor.label': 'Editor',
  /** Topbar title for the Editor view. */
  'nav.editor.title': 'Editor',
  /** Topbar subtitle for the Editor view. */
  'nav.editor.subtitle': 'Capture a thought, claim, or note',
  /** Sidebar and mobile drawer label for the Library view. */
  'nav.library.label': 'Library',
  /** Topbar title for the Library view. */
  'nav.library.title': 'Library',
  /** Topbar subtitle for the Library view. */
  'nav.library.subtitle': 'Browse and filter your entities',
  /** Sidebar and mobile drawer label for the Graph view. */
  'nav.graph.label': 'Graph',
  /** Topbar title for the Graph view. */
  'nav.graph.title': 'Graph',
  /** Topbar subtitle for the Graph view. */
  'nav.graph.subtitle': 'Visualize relationships',
  /** Sidebar and mobile drawer label for the Mind Map view. */
  'nav.mindmap.label': 'Mind Map',
  /** Topbar title for the Mind Map view. */
  'nav.mindmap.title': 'Mind Map',
  /** Topbar subtitle for the Mind Map view. */
  'nav.mindmap.subtitle': 'Hierarchical exploration',
  /** Sidebar and mobile drawer label for the Chat view. */
  'nav.chat.label': 'Chat',
  /** Topbar title for the Chat view. */
  'nav.chat.title': 'Chat',
  /** Topbar subtitle for the Chat view. */
  'nav.chat.subtitle': 'Ask your library',
  /** Sidebar and mobile drawer label for the AI Harness view. */
  'nav.ai.label': 'AI Harness',
  /** Topbar title for the AI Harness view. */
  'nav.ai.title': 'AI Harness',
  /** Topbar subtitle for the AI Harness view. */
  'nav.ai.subtitle': 'Configure and chat with LLMs',
  /** Sidebar and mobile drawer label for the TRIZ Matrix view. */
  'nav.triz.label': 'TRIZ Matrix',
  /** Topbar title for the TRIZ Matrix view. */
  'nav.triz.title': 'TRIZ Matrix',
  /** Topbar subtitle for the TRIZ Matrix view. */
  'nav.triz.subtitle': 'Solve inventive contradictions',
  /** Sidebar and mobile drawer label for the Export view. */
  'nav.export.label': 'Export',
  /** Topbar title for the Export view. */
  'nav.export.title': 'Export',
  /** Topbar subtitle for the Export view. */
  'nav.export.subtitle': 'Backup and share your knowledge',
  /** Sidebar and mobile drawer label for the Sync view. */
  'nav.sync.label': 'Sync',
  /** Topbar title for the Sync view. */
  'nav.sync.title': 'Sync',
  /** Topbar subtitle for the Sync view. */
  'nav.sync.subtitle': 'Connect devices and sync peer-to-peer',
  /** Sidebar / mobile drawer section heading: overview group. */
  'nav.group.overview': 'Overview',
  /** Sidebar / mobile drawer section heading: capture group. */
  'nav.group.capture': 'Capture',
  /** Sidebar / mobile drawer section heading: explore group. */
  'nav.group.explore': 'Explore',
  /** Sidebar / mobile drawer section heading: ask group. */
  'nav.group.ask': 'Ask',
  /** Sidebar / mobile drawer section heading: lab group. */
  'nav.group.lab': 'Lab',
  /** Sidebar / mobile drawer section heading: data group. */
  'nav.group.data': 'Data',
} as const

/** Typed `translate` helper bound to the navigation message scope. */
export const translate = makeT(messages)
