/**
 * Editor view i18n messages.
 *
 * User-facing strings for the editor surface. This scope currently covers the
 * discard-changes confirmation (#863); the status-bar labels still live as
 * constants in `editor-hooks.tsx` and can migrate here incrementally.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible name of the discard-changes confirmation dialog. */
  'editor.discard.ariaLabel': 'Confirm discard changes',
  /** Discard confirmation heading. */
  'editor.discard.title': 'Discard changes?',
  /** Discard confirmation subtitle. */
  'editor.discard.subtitle': 'The autosaved draft is removed.',
  /** Discard confirmation body. */
  'editor.discard.body':
    'Your edits and the autosaved draft for this entity will be deleted. This cannot be undone.',
  /** Discard dialog dismiss action. */
  'editor.discard.cancel': 'Cancel',
} as const

/** Typed `translate` helper bound to the editor view message scope. */
export const translate = makeT(messages)
