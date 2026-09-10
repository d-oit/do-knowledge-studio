import { makeT } from '@/lib/i18n/t'

/**
 * N3 @mention entity linking — user-facing strings (plan 135).
 * Registered with Main for the i18n registry index.
 */
const messages = {
  'mentions.picker.ariaLabel': 'Mention an entity',
  'mentions.picker.hint': 'Type to filter, Enter to insert, Esc to close',
  'mentions.picker.empty': 'No matching entities',
  'mentions.picker.option': (name: string, typeLabel: string) => `${name} (${typeLabel})`,
} as const

export const translate = makeT(messages)