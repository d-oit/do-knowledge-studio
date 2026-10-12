/**
 * Chat view i18n messages.
 *
 * User-facing strings for the local chat surface. This scope currently covers
 * the clear-history confirmation (#863); the remaining chat copy still lives as
 * exported constants in `chat-subcomponents.tsx` and can migrate here
 * incrementally without a central registry.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible name of the clear-chat-history confirmation dialog. */
  'chat.clear.ariaLabel': 'Confirm clear chat history',
  /** Clear-chat confirmation heading. */
  'chat.clear.title': 'Clear chat history?',
  /** Clear-chat confirmation subtitle. */
  'chat.clear.subtitle': 'This deletes the whole conversation.',
  /** Clear-chat confirmation body. */
  'chat.clear.body':
    'Every message in this conversation will be removed from this browser. This cannot be undone.',
  /** Clear-chat dialog dismiss action. */
  'chat.clear.cancel': 'Cancel',
} as const

/** Typed `translate` helper bound to the chat view message scope. */
export const translate = makeT(messages)
