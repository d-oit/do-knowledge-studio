/**
 * Import i18n messages (N5).
 *
 * User-facing strings for the import dropzone and the import preview dialog
 * rendered in the export view.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible name of the import preview dialog. */
  'import.ariaLabel': 'Confirm import',
  /** Import preview dialog heading. */
  'import.title': 'Import preview',
  /** Import preview dialog subtitle. */
  'import.subtitle': 'Review before replacing your library.',
  /** Row label for the entity count. */
  'import.entities': 'Entities',
  /** Row label for the claim count. */
  'import.claims': 'Claims',
  /** Warning about duplicate IDs being replaced; count interpolated. */
  'import.duplicates': (count: string) =>
    `${count} existing ${count === '1' ? 'entity' : 'entities'} will be replaced (matching IDs detected).`,
  /** Import preview body explaining the destructive scope. */
  'import.body':
    'This will replace all current entities and claims. A snapshot is taken so you can undo if something goes wrong.',
  /** Import preview dismiss action. */
  'import.cancel': 'Cancel',
  /** Import preview confirm action. */
  'import.confirm': 'Confirm import',

  /** Dropzone heading. */
  'import.dropzone.title': 'Import knowledge',
  /** Dropzone subtitle. */
  'import.dropzone.subtitle':
    'Replace your current library with the contents of a JSON export. This action cannot be undone.',
  /** Dropzone call-to-action heading. */
  'import.dropzone.chooseHeading': 'Choose files or a folder',
  /** Dropzone hint describing the accepted export shape. */
  'import.dropzone.acceptsHint':
    'Accepts JSON exports, Markdown exports, .md notes, vault folders, and .zip vaults',
  /** Dropzone file picker button. */
  'import.dropzone.chooseButton': 'Choose files',
  /** Dropzone folder picker button. */
  'import.dropzone.chooseFolderButton': 'Choose folder',
  /** Preview row for stub entities minted for unresolvable vault links. */
  'import.stubs': (count: string) =>
    `${count} new stub ${count === '1' ? 'entity' : 'entities'} will be created for links with no match:`,
  /** Preview row for vault names shared by several notes. */
  'import.conflicts': (count: string) =>
    `${count} duplicate ${count === '1' ? 'name' : 'names'} imported as separate entities:`,
  /** Suffix capping long stub/conflict name lists. */
  'import.moreNames': (count: string) => `…and ${count} more`,
} as const

/** Typed `translate` helper bound to the import message scope. */
export const translate = makeT(messages)