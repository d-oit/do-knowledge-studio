/**
 * Shared entity-deletion confirmation messages (#863).
 *
 * Every surface that can destroy an entity — the inspector panel, the graph
 * canvas, and the mind map toolbar — renders the same confirmation copy. It
 * lives in one scope so the three dialogs cannot drift apart; the previous
 * `inspector.ts` scope held the same strings for a single caller.
 */

import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible name of the delete-entity confirmation dialog. */
  'entityDelete.ariaLabel': 'Confirm delete',
  /** Delete confirmation heading. */
  'entityDelete.title': 'Delete entity?',
  /** Delete confirmation subtitle. */
  'entityDelete.subtitle': 'This cannot be undone.',
  /** Delete confirmation body naming the entity about to be removed. */
  'entityDelete.body': (name: string) =>
    `"${name}" will be permanently deleted. This cannot be undone.`,
  /** Delete dialog dismiss action. */
  'entityDelete.cancel': 'Cancel',
  /** Destructive delete action. */
  'entityDelete.confirm': 'Delete',
} as const

/** Typed `translate` helper bound to the entity-delete message scope. */
export const translate = makeT(messages)
