/**
 * Home dashboard i18n messages (#870).
 *
 * User-facing strings for the home view's hero header and its empty state.
 * The existing greeting row and dashboard section headings are not part of
 * this scope yet.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Hero header subtitle of the home dashboard. */
  'home.subtitle': 'Your studio at a glance — recent work, counts, and where to go next.',
  /** Empty state headline shown in the recent-work section. */
  'home.empty.title': 'No entities yet',
  /** Empty state body inviting the first capture. */
  'home.empty.body': 'Create your first one to get started.',
  /** Empty state action that opens a blank entity in the editor. */
  'home.empty.action': 'Create entity',
} as const

/** Typed `translate` helper bound to the home message scope. */
export const translate = makeT(messages)
