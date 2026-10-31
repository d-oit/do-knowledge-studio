/**
 * Verifiable backup and restore messages (Issue #1040).
 *
 * All user-facing archive copy lives here so future localization does not have
 * to reach into the backup handlers or dialog markup.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  'backup.title': 'Verifiable backup',
  'backup.description':
    'A single portable archive with SHA-256 checksums for every payload file. Restores are previewed and only applied after validation.',
  'backup.download': 'Download backup',
  'backup.downloading': 'Building archive…',
  'backup.passphrase': 'Backup passphrase',
  'backup.passphrasePlaceholder': 'Optional — encrypt the whole archive',
  'backup.passphraseHelp':
    'Leave blank for a transparent archive. An encrypted archive cannot be recovered without this passphrase; it is never stored or logged.',
  'backup.restore': 'Restore backup',
  'backup.restoreHint': 'Select a .dksb archive. Integrity and references are checked before anything is written.',
  'backup.verify': 'Preview restore',
  'backup.verifying': 'Verifying archive…',
  'backup.downloaded': 'Backup downloaded',
  'backup.downloadedBody': (files: string) => `${files} checksummed payload file(s) included.`,
  'backup.downloadFailed': 'Backup could not be created',
  'backup.invalid': 'Backup could not be verified',
  'backup.passphraseRequired': 'This archive is encrypted. Enter its passphrase and preview again.',
  'backup.verifiedTitle': 'Restore preview',
  'backup.verifiedBody': 'Integrity checks passed. Choose how this archive is applied.',
  'backup.records': 'Records',
  'backup.counts': (entities: string, claims: string) => `${entities} entities · ${claims} claims`,
  'backup.exportedAt': 'Exported',
  'backup.appVersion': 'App version',
  'backup.integrity': 'Integrity',
  'backup.integrityVerified': 'Verified',
  'backup.warnings': 'Warnings',
  'backup.errors': 'Errors',
  'backup.mode': 'Restore mode',
  'backup.modeReplace': 'Replace the current library',
  'backup.modeMerge': 'Merge into the current library',
  'backup.duplicatePolicy': 'Duplicate ids',
  'backup.duplicateSkip': 'Keep existing records (skip duplicates)',
  'backup.duplicateOverwrite': 'Replace existing records (overwrite)',
  'backup.confirmReplace': 'Replace library',
  'backup.confirmMerge': 'Merge backup',
  'backup.cancel': 'Cancel',
  'backup.applied': 'Backup restored',
  'backup.appliedBody': (entities: string, claims: string) => `${entities} entities and ${claims} claims applied atomically.`,
  'backup.applyFailed': 'Backup restore failed',
  'backup.close': 'Close backup preview',
} as const

/** Typed `translate` helper bound to the backup message scope. */
export const translate = makeT(messages)
