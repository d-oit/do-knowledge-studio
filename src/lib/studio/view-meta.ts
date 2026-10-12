/**
 * Single source of truth for view presentation metadata (#865).
 *
 * The desktop sidebar, the topbar and the mobile drawer all need a display
 * label, title and subtitle for the current view. They used to each hold their
 * own hardcoded map, which drifted. This module composes the `nav.*` i18n
 * scope with the Timeline scope's own strings into one `VIEW_META` table.
 *
 * Held in a `Map` so lookups are method calls rather than dynamic property
 * access on an object (static-analysis object-injection sink).
 */

import { translate as navT } from '@/lib/i18n/messages/nav'
import { translate as timelineT } from '@/lib/i18n/messages/timeline'
import type { ViewId } from '@/lib/studio/types'

/** Display metadata for a view: sidebar label, topbar title and subtitle. */
export interface ViewMeta {
  /** Short label used in navigation and the error boundary. */
  readonly label: string
  /** Topbar heading. */
  readonly title: string
  /** Topbar subtitle. */
  readonly subtitle: string
}

const meta = (label: string, title: string, subtitle: string): ViewMeta => ({
  label,
  title,
  subtitle,
})

/** View id → presentation metadata. */
export const VIEW_META: ReadonlyMap<ViewId, ViewMeta> = new Map<ViewId, ViewMeta>([
  ['home', meta(navT('nav.label.home'), navT('nav.title.home'), navT('nav.subtitle.home'))],
  ['editor', meta(navT('nav.label.editor'), navT('nav.title.editor'), navT('nav.subtitle.editor'))],
  [
    'library',
    meta(navT('nav.label.library'), navT('nav.title.library'), navT('nav.subtitle.library')),
  ],
  ['graph', meta(navT('nav.label.graph'), navT('nav.title.graph'), navT('nav.subtitle.graph'))],
  [
    'mindmap',
    meta(navT('nav.label.mindmap'), navT('nav.title.mindmap'), navT('nav.subtitle.mindmap')),
  ],
  ['chat', meta(navT('nav.label.chat'), navT('nav.title.chat'), navT('nav.subtitle.chat'))],
  ['ai', meta(navT('nav.label.ai'), navT('nav.title.ai'), navT('nav.subtitle.ai'))],
  ['triz', meta(navT('nav.label.triz'), navT('nav.title.triz'), navT('nav.subtitle.triz'))],
  ['export', meta(navT('nav.label.export'), navT('nav.title.export'), navT('nav.subtitle.export'))],
  ['sync', meta(navT('nav.label.sync'), navT('nav.title.sync'), navT('nav.subtitle.sync'))],
  [
    'timeline',
    meta(timelineT('timeline.nav.label'), timelineT('timeline.title'), timelineT('timeline.subtitle')),
  ],
])

/** Fallback used when an unknown view id reaches the topbar. */
const HOME_META: ViewMeta = meta(
  navT('nav.label.home'),
  navT('nav.title.home'),
  navT('nav.subtitle.home'),
)

/** Bounded lookup with a home fallback for unknown view ids. */
export const getViewMeta = (view: ViewId): ViewMeta => VIEW_META.get(view) ?? HOME_META
