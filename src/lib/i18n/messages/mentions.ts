import { makeT } from '@/lib/i18n/t'

/**
 * N3 @mention entity linking — user-facing strings (plan 135).
 * Per-scope i18n module (no central registry): consumers import `translate`
 * from this file directly.
 */
const messages = {
  'mentions.picker.ariaLabel': 'Mention an entity',
  'mentions.picker.hint': 'Type to filter, Enter to insert, Esc to close',
  'mentions.picker.empty': 'No matching entities',
  'mentions.picker.option': (name: string, typeLabel: string) => `${name} (${typeLabel})`,
  /** Create-row in the picker: makes a stub entity for the typed query. */
  'mentions.picker.create': (name: string) => `Create "${name}"`,
  /** Accessible label for the picker create-row. */
  'mentions.picker.createAria': (name: string) => `Create new entity "${name}"`,
  /** Announcement when a mention token is inserted. */
  'mentions.announce.inserted': (name: string) => `Mentioned ${name}`,
  /** Announcement when a stub entity is created from the picker. */
  'mentions.announce.created': (name: string) => `Created and mentioned ${name}`,
  /** Unlinked-mentions section heading in the inspector. */
  'mentions.unlinked.heading': 'Mentioned without a link',
  /** One-click action that turns an unlinked mention into a token. */
  'mentions.unlinked.link': 'Link',
  /** Accessible label for an unlinked-mention link action. */
  'mentions.unlinked.linkAria': (name: string) => `Link mention in ${name}`,
  /** Rename confirmation heading when link text can follow the new name. */
  'mentions.rename.title': 'Update link text?',
  /** Rename confirmation body; counts the notes showing the old name. */
  'mentions.rename.body': (count: string, oldName: string, newName: string) =>
    `${count} note${count === '1' ? '' : 's'} link to "${oldName}" with that text. Show "${newName}" instead? Links keep working either way.`,
  /** Rename confirmation action. */
  'mentions.rename.confirm': 'Update link text',
} as const

export const translate = makeT(messages)