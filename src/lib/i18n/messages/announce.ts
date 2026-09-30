/**
 * Screen-reader announcement messages (Plan 157 Phase 5).
 *
 * The `<Announcer />` live region is mounted at the root layout, but nothing
 * ever spoke into it: a sighted user got a toast and a visible navigation
 * change, while a screen-reader user got silence. These strings are what
 * close that gap — one polite announcement per consequential mutation.
 *
 * Wording rules for a live region: state the outcome, not the action, and
 * never include punctuation that changes how a verb is spoken.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** An entity was written to the library. */
  'announce.entitySaved': (name: string) => `Saved ${name}`,
  /** A new entity was created and left in the editor. */
  'announce.entityCreated': (name: string) => `Created ${name}`,
  /** An entity was removed along with its claims. */
  'announce.entityDeleted': (name: string) => `Deleted ${name}`,
  /** The active view changed. */
  'announce.viewSwitched': (view: string) => `Switched to ${view}`,
  /** An import replaced the library. Counts are interpolated, so the
   *  plural form has to be selected at the call site (this layer carries no
   *  locale, and `Intl.PluralRules` needs one). */
  'announce.importSucceeded': (entities: string, entityNoun: string, claims: string, claimNoun: string) =>
    `Imported ${entities} ${entityNoun} and ${claims} ${claimNoun}`,
  /** An import failed and the previous library was restored. */
  'announce.importFailed': 'Import failed, your previous library was restored',
  /** A claim was attached to an entity. */
  'announce.claimAdded': (count: string) =>
    count === '1' ? 'Added 1 claim' : `Added ${count} claims`,
  /** A claim was removed. */
  'announce.claimDeleted': 'Deleted claim',
  /** The workspace was reset to the demo dataset. */
  'announce.storeReset': 'Restored the demo library',
  /** A graph canvas snapshot was written. */
  'announce.snapshotSaved': 'Snapshot saved',
  /** A graph canvas snapshot was applied. */
  'announce.snapshotRestored': 'Snapshot restored',
  /** The graph canvas snapshot was discarded. */
  'announce.snapshotCleared': 'Snapshot cleared',
  /** The mind map density changed. */
  'announce.densityChanged': (density: string) => `Density set to ${density}`,
  /** Entity selection changed in the right panel. */
  'announce.entitySelected': (name: string) => `Selected ${name}`,
  /** Banner heading when a payload was preserved but not loaded. */
  'announce.quarantineTitle': 'A previous version of your library could not be loaded',
  /** Banner body naming what was preserved. Deliberately does NOT promise a
   *  re-import: the download is the raw persistence envelope, not the export
   *  schema, so Import would reject it. */
  'announce.quarantineBody': (summary: string) =>
    `We kept an untouched copy of ${summary} rather than discard it. Download it to keep it safe. The file is the raw saved data, not an importable library, so recover from it with a build that can read that version.`,
  /** Banner action that downloads the preserved payload. */
  'announce.quarantineDownload': 'Download copy',
  /** Banner action that hides the warning for this page session only. It
   *  never deletes the preserved copy, so a reload brings the warning back. */
  'announce.quarantineDismiss': 'Hide warning for this page session',
  /** Heading when NO copy of the refused library could be preserved. */
  'announce.quarantineUnpreservedTitle': 'Your library could not be loaded or saved',
  /** Body for the unpreserved case: edits are not being saved. */
  'announce.quarantineUnpreservedBody':
    'We could not keep a safe copy, so nothing you change now will be saved, and publishing to other tabs is disabled. The bytes in this browser were left untouched. Free up storage or allow site data, then reload.',
  /** Body for the unpreserved case when the bytes could not be read back. */
  'announce.quarantineUnpreservedBodyUnreadable':
    'We could not keep a safe copy and cannot read the original bytes, so there is nothing to download. Nothing you change now will be saved. Free up storage or allow site data, then reload.',
  /** Spoken confirmation after a download. */
  'announce.preservedLibraryDownloaded': 'Preserved library downloaded',
  /** Toast when the download fails. */
  'announce.preservedLibraryFailed': 'Could not download the preserved copy',
} as const

/** Typed `translate` helper bound to the announcement message scope. */
export const translate = makeT(messages)
