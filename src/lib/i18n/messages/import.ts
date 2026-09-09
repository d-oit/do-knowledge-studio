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
  'import.dropzone.chooseHeading': 'Choose a JSON file',
  /** Dropzone hint describing the accepted export shape. */
  'import.dropzone.acceptsHint': 'Accepts exports from this view ({ entities: [], claims: [] })',
  /** Dropzone file picker button. */
  'import.dropzone.chooseButton': 'Choose file',
} as const

/** Typed `t` helper bound to the import message scope. */
export const t = makeT(messages)