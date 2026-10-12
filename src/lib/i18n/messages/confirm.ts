import { makeT } from '@/lib/i18n/t'

/**
 * Confirmation-dialog message scope (#863).
 *
 * Copy for the shared `ConfirmDialog` and the destructive actions that gate on
 * it. The reset-to-demo dialog keeps its own `export.reset.*` keys (the export
 * view owns that flow); every other confirmation lives here so the wording of
 * "this cannot be undone" stays in one place (AGENTS.md: never hardcode
 * user-facing strings).
 */
const messages = {
  /** Default dismiss action for the shared confirmation dialog. */
  'confirm.cancel': 'Cancel',

  /** Delete-entity confirmation heading. */
  'confirm.deleteEntity.title': 'Delete entity?',
  /** Delete-entity confirmation body; names the entity about to be removed. */
  'confirm.deleteEntity.body': (name: string) =>
    `"${name}" will be permanently deleted. This cannot be undone.`,
  /** Delete-entity confirming action. */
  'confirm.deleteEntity.confirm': 'Delete',

  /** Clear-chat confirmation heading. */
  'confirm.clearChat.title': 'Clear chat history?',
  /** Clear-chat confirmation body. */
  'confirm.clearChat.body':
    'Every message in this conversation will be removed. This cannot be undone.',
  /** Clear-chat confirming action. */
  'confirm.clearChat.confirm': 'Clear chat',

  /** Discard-draft confirmation heading. */
  'confirm.discardDraft.title': 'Discard changes?',
  /** Discard-draft confirmation body. */
  'confirm.discardDraft.body':
    'Your unsaved changes and the autosaved draft will be deleted. This cannot be undone.',
  /** Discard-draft confirming action. */
  'confirm.discardDraft.confirm': 'Discard',
} as const

/** Typed `translate` helper bound to the confirmation-dialog message scope. */
export const translate = makeT(messages)
