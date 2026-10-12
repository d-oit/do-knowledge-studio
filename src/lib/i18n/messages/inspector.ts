/**
 * Inspector panel i18n messages.
 *
 * User-facing strings for the right-hand inspector panel (`right-panel.tsx`).
 * This scope currently covers the delete-entity confirmation (#863).
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible name of the delete-entity confirmation dialog. */
  'inspector.delete.ariaLabel': 'Confirm delete',
  /** Delete confirmation heading. */
  'inspector.delete.title': 'Delete entity?',
  /** Delete confirmation subtitle. */
  'inspector.delete.subtitle': 'This cannot be undone.',
  /** Delete confirmation body naming the entity about to be removed. */
  'inspector.delete.body': (name: string) =>
    `"${name}" will be permanently deleted. This cannot be undone.`,
  /** Delete dialog dismiss action. */
  'inspector.delete.cancel': 'Cancel',
  /** Destructive delete action. */
  'inspector.delete.confirm': 'Delete',
} as const

/** Typed `translate` helper bound to the inspector panel message scope. */
export const translate = makeT(messages)
