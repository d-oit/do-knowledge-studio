/**
 * Settings view i18n messages (Plan 192 follow-up).
 *
 * User-facing strings for the storage report: what the semantic index and the
 * model cache cost, and what dropping either one does.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Hero header title. */
  'settings.title': 'Settings',
  /** Hero header subtitle. */
  'settings.subtitle': 'What this studio stores locally, and how to reclaim it.',
  /** Section heading for the semantic index. */
  'settings.semantic.title': 'Semantic index',
  /** Explains what the semantic index is and that it can be rebuilt. */
  'settings.semantic.description':
    'Vectors for every entity and claim, held in memory and cached in IndexedDB. Rebuilding is safe: the content itself is not touched.',
  /** Label for the document count. */
  'settings.semantic.documents': 'Documents indexed',
  /** Label for the in-memory size. */
  'settings.semantic.bytes': 'Memory in use',
  /** Label for the configured ceiling. */
  'settings.semantic.budget': 'Memory budget',
  /** Label for the index lifecycle state. */
  'settings.semantic.status': 'Status',
  /** Button that drops the index so the next search rebuilds it. */
  'settings.semantic.rebuild': 'Rebuild index',
  /** Confirmation that the index was dropped. */
  'settings.semantic.rebuilt': 'Semantic index cleared',
  /** Explanation shown under the rebuild button. */
  'settings.semantic.rebuildHint':
    'The next semantic search re-embeds the library. On a cold model this downloads it again.',
  /** Section heading for the embedding-model cache. */
  'settings.model.title': 'Model cache',
  /** Explains what the model cache holds. */
  'settings.model.description':
    'Embedding-model weights and tokenizer files, kept offline so a reload never needs the network.',
  /** Label for the cached file count. */
  'settings.model.entries': 'Cached files',
  /** Label for the cache size on disk. */
  'settings.model.bytes': 'Disk in use',
  /** Label for the cache ceiling. */
  'settings.model.budget': 'Cache budget',
  /** Button that deletes the model cache. */
  'settings.model.clear': 'Clear model cache',
  /** Confirmation that the cache was deleted. */
  'settings.model.cleared': 'Model cache cleared',
  /** Shown when there was nothing to delete. */
  'settings.model.empty': 'No cached model files',
  /** Explanation shown under the clear button. */
  'settings.model.clearHint':
    'The next semantic search downloads the model again, which needs a network connection.',
  /** Shown when storage cannot be measured at all. */
  'settings.unavailable': 'Storage is not available in this browser',
  /** Section heading for origin storage diagnostics. */
  'settings.origin.title': 'Origin storage',
  /** Explains what the origin panel measures. */
  'settings.origin.description':
    'What your browser reports this site may use on this device, and whether it protects the data from eviction.',
  /** Label for the estimated usage row. */
  'settings.origin.usage': 'Estimated usage',
  /** Label for the estimated quota row. */
  'settings.origin.quota': 'Estimated quota',
  /** Notes that usage and quota are estimates, not exact disk usage. */
  'settings.origin.estimatesHint': 'Usage and quota are browser estimates, not exact disk usage.',
  /** Explains the estimate covers every app-owned store, not per-store sizes. */
  'settings.origin.coverage':
    "One estimate, all stores: the number above is your browser's estimate for everything this site stores here — notes, attachments, cached models, and recovery copies. Individual stores are not weighed separately.",
  /** Shown when the browser refused to return an estimate. */
  'settings.origin.measureFailed': 'Your browser did not return usable storage measurements.',
  /** Shown when the Storage API is missing. */
  'settings.origin.unsupported': 'This browser does not expose origin storage diagnostics.',
  /** Label for the persistent-storage status line. */
  'settings.origin.persisted': 'Persistent storage',
  /** Status when persistence was granted. */
  'settings.origin.persistedGranted':
    "Granted — the browser will avoid evicting this site's data under storage pressure.",
  /** Status when persistence was not granted. */
  'settings.origin.persistedNotGranted':
    "Not granted — under storage pressure the browser may evict this site's data.",
  /** Status while the browser has not said yet. */
  'settings.origin.persistedUnknown': 'Status unavailable',
  /** Shown when the browser did not provide an estimate field. */
  'settings.origin.valueUnavailable': 'Unavailable',
  /** Explains when the browser exposes no persistent-storage request. */
  'settings.origin.persistUnavailable': 'This browser cannot request persistent storage.',
  /** Button that requests persistent storage. */
  'settings.origin.persistAction': 'Request persistent storage',
  /** Toast when the browser granted persistence. */
  'settings.origin.persistGranted': 'Persistent storage granted',
  /** Toast when the browser declined persistence. */
  'settings.origin.persistDenied':
    'The browser declined persistent storage. Your data may still be evicted.',
  /** Explains persistence is not a backup. */
  'settings.origin.notBackup':
    "Persistent storage is not a backup: it only asks the browser not to evict this site's data. It cannot prevent manual site-data deletion or device loss.",
  /** Link to the backup/export view. */
  'settings.origin.backupLink': 'Back up your library',
  /** Quota warning, with the reported usage percentage. */
  'settings.origin.nearQuota': (percent: string) =>
    `Your browser reports this site is using about ${percent}% of its estimated storage quota. Near the limit the browser may evict data — back up anything you cannot recreate.`,
  /** Settings persist failure toast. */
  'settings.save.failed': 'Failed to save settings. Your changes may not persist.',
  /** Section heading for at-rest encryption. */
  'settings.encryption.title': 'Workspace encryption',
  /** Explains what at-rest encryption covers. */
  'settings.encryption.description':
    'Seal the library on this device with a passphrase. The corpus, its revision history and everything else that holds note text are stored as ciphertext.',
  /** Status when encryption is off. */
  'settings.encryption.statusOff': 'Off — the library is stored unencrypted in this browser.',
  /** Status when encryption is on and unlocked. */
  'settings.encryption.statusUnlocked': 'On — unlocked for this tab only.',
  /** Status when encryption is on and locked. */
  'settings.encryption.statusLocked':
    'On — locked. The library cannot be read or changed until you unlock it.',
  /** What at-rest encryption does not protect against. */
  'settings.encryption.threatModel':
    'At-rest encryption protects the stored bytes on this device: a lost or shared computer, a copied browser profile, or disk forensics. It does not protect a running, compromised browser — malicious script in this page can read the library while it is unlocked.',
  /** Irreversible loss warning. */
  'settings.encryption.lossWarning':
    'There is no recovery key. If you forget this passphrase, the library cannot be opened again on this device — keep a passphrase you can remember and export a backup you control.',
  /** Label for the passphrase field. */
  'settings.encryption.passphrase': 'Passphrase',
  /** Hint under the passphrase field. */
  'settings.encryption.passphraseHint': (min: string) =>
    `At least ${min} characters. It is never stored or sent anywhere.`,
  /** Label for the confirmation field. */
  'settings.encryption.confirm': 'Confirm passphrase',
  /** Button that encrypts the workspace. */
  'settings.encryption.enable': 'Encrypt this workspace',
  /** Confirmation after enabling. */
  'settings.encryption.enabled': 'Workspace encrypted',
  /** Button that unlocks a locked workspace. */
  'settings.encryption.unlock': 'Unlock',
  /** Confirmation after unlocking. */
  'settings.encryption.unlocked': 'Workspace unlocked',
  /** Button that locks the workspace now. */
  'settings.encryption.lock': 'Lock now',
  /** Confirmation after locking. */
  'settings.encryption.locked': 'Workspace locked',
  /** Button that removes encryption. */
  'settings.encryption.disable': 'Turn encryption off',
  /** Confirmation after disabling. */
  'settings.encryption.disabled': 'Encryption turned off',
  /** Explains what turning encryption off does to the stored bytes. */
  'settings.encryption.disableHint':
    'Turning encryption off rewrites the library and its history as plaintext. Only do this if you accept that.',
  /** Explains the excluded surfaces, honestly. */
  'settings.encryption.exclusions':
    'While encryption is on: editor draft recovery is off, pre-import recovery snapshots are not kept in plaintext, and the derived semantic index is dropped whenever you lock. The encrypted backup export is the recovery route.',
  /** Link/instruction for the backup route. */
  'settings.encryption.backupHint':
    'Before enabling, export a backup and keep the passphrase for it separately.',
  /** Shown when an operation fails. */
  'settings.encryption.failed': 'That did not work',
  /** Lock screen title. */
  'settings.encryption.lockScreenTitle': 'This workspace is locked',
  /** Lock screen description. */
  'settings.encryption.lockScreenBody':
    'Enter your passphrase to open the encrypted library. Nothing is read from storage until it unlocks.',
  /** Lock screen submit button. */
  'settings.encryption.lockScreenSubmit': 'Unlock workspace',
} as const

/** Typed `translate` helper bound to the settings message scope. */
export const translate = makeT(messages)
