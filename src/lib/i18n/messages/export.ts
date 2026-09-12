/**
 * Export/import view i18n messages (N5).
 *
 * User-facing strings for the export view family: the export format grid,
 * backup tips, the encrypted-export dialog, and the reset confirmation
 * dialog. The import dropzone/preview dialog live in the `import` scope.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Footer summary of what is stored in the browser. */
  'export.view.counts': (entities: string, claims: string) =>
    `${entities} entities · ${claims} claims · saved to this browser`,
  /** Tooltip for the reset-to-demo button. */
  'export.view.resetTitle': 'Clear the local store and restore the seed entities',
  /** Button that opens the reset confirmation dialog. */
  'export.view.resetButton': 'Reset to demo data',

  /** Export view heading. */
  'export.grid.title': 'Export knowledge',
  /** Export view subtitle. */
  'export.grid.subtitle':
    'Your data is local. Export it whenever you want — for backup, sharing, or migration.',
  /** Empty state shown when there are no entities to export. */
  'export.grid.empty': 'No entities to export yet. Create some content first.',
  /** Button that navigates to the editor when the library is empty. */
  'export.grid.createEntity': 'Create entity',
  /** Hover action label on an available format card. */
  'export.grid.exportNow': 'Export now',
  /** Label on a format card that is not yet available. */
  'export.grid.notAvailable': 'Not yet available',

  /** Backup tips card heading. */
  'export.backupTips.title': 'Backup tips',
  /** Backup tip: JSON completeness. */
  'export.backupTips.json':
    'JSON exports are the most complete — they preserve all entities, claims, links, and tags.',
  /** Backup tip: PDF/DOCX. */
  'export.backupTips.pdfDocx': 'PDF and DOCX are print-ready — great for sharing or archival.',
  /** Backup tip: encrypted HTML. */
  'export.backupTips.encryptedHtml':
    'Encrypted HTML is safe to email — the recipient needs the password to read it. (AES-256-GCM encrypted.)',
  /** Backup tip: automatic local saving. */
  'export.backupTips.autoSave':
    'Your library is automatically saved to this browser. Export a JSON backup weekly to be safe.',

  /** Accessible name of the encrypted-export dialog. */
  'export.encrypt.ariaLabel': 'Encrypt export',
  /** Encrypted-export dialog heading. */
  'export.encrypt.title': 'Encrypt export',
  /** Encrypted-export dialog subtitle. */
  'export.encrypt.subtitle': 'AES-256-GCM encryption with PBKDF2 key derivation.',
  /** Password field label. */
  'export.encrypt.passwordLabel': 'Password',
  /** Password input placeholder. */
  'export.encrypt.passwordPlaceholder': 'Choose a strong password',
  /** Accessible label for the visibility toggle when the password is shown. */
  'export.encrypt.hidePassword': 'Hide password',
  /** Accessible label for the visibility toggle when the password is hidden. */
  'export.encrypt.showPassword': 'Show password',
  /** Visibility toggle text when the password is shown. */
  'export.encrypt.hide': 'Hide',
  /** Visibility toggle text when the password is hidden. */
  'export.encrypt.show': 'Show',
  /** Confirmation field label. */
  'export.encrypt.confirmLabel': 'Confirm password',
  /** Confirmation input placeholder. */
  'export.encrypt.confirmPlaceholder': 'Re-enter password',
  /** Inline error when the two passwords differ. */
  'export.encrypt.mismatch': 'Passwords do not match.',
  /** Dialog dismiss action. */
  'export.encrypt.cancel': 'Cancel',
  /** Submit action for the encrypted export. */
  'export.encrypt.submit': 'Encrypt & export',

  /** Accessible name of the reset confirmation dialog. */
  'export.reset.ariaLabel': 'Confirm reset',
  /** Reset confirmation heading. */
  'export.reset.title': 'Reset to demo data?',
  /** Reset confirmation subtitle. */
  'export.reset.subtitle': 'This will delete all your entities and claims.',
  /** Reset confirmation body. */
  'export.reset.body': 'This action cannot be undone. Export your data first if you want to keep it.',
  /** Reset dialog dismiss action. */
  'export.reset.cancel': 'Cancel',
  /** Destructive reset action. */
  'export.reset.confirm': 'Reset everything',
} as const

/** Typed `translate` helper bound to the export view message scope. */
export const translate = makeT(messages)