/**
 * Presence and offline i18n messages (N5).
 *
 * User-facing strings for `presence-indicator.tsx` and
 * `offline-indicator.tsx`.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Presence count in the compact avatar stack; count interpolated. */
  'presence.online': (count: string) => `${count} online`,
  /** Suffix marking the local user in the presence list. */
  'presence.you': '(you)',

  /** Offline banner text. */
  'offline.banner': 'You are offline — changes will sync when reconnected',
} as const

/** Typed `translate` helper bound to the presence/offline message scope. */
export const translate = makeT(messages)