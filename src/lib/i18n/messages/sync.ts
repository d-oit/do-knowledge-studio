/**
 * Sync view i18n messages (N5).
 *
 * User-facing strings for `sync-view.tsx` and shared room-status labels used by
 * `sync-helpers.tsx`.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Sync view subtitle. */
  'sync.subtitle': 'Connect devices and sync your knowledge base peer-to-peer.',
  /** Sync history panel heading. */
  'sync.history.title': 'Sync History',
  /** Sync history empty state. */
  'sync.history.empty': 'No sync events yet.',
  /** Online users panel heading. */
  'sync.onlineUsers': 'Online Users',

  /** Event log entry when sync storage initialization fails. */
  'sync.event.initFailed': 'Failed to initialize sync storage',
  /** Event log entry when the shared document finishes syncing. */
  'sync.event.synced': 'Document synchronized',
  /** Status badge when the local room is active without a connected peer. */
  'sync.status.roomActive': 'Room active',
  /** Status badge when the provider reports at least one peer. */
  'sync.status.peersConnected': 'Peers connected',
  /** Status badge while the provider is joining a room. */
  'sync.status.connecting': 'Connecting',
  /** Status badge while IndexedDB persistence is loading. */
  'sync.status.persistenceLoading': 'Loading storage…',
  /** Status badge while sync merge is active. */
  'sync.status.syncing': 'Syncing…',
  /** Status badge when conflicts need resolution. */
  'sync.status.conflict': 'Conflict',
  /** Status badge while leaving a room. */
  'sync.status.leaving': 'Leaving…',
  /** Status badge when the room cannot be joined. */
  'sync.status.error': 'Error',
  /** Status badge when no room is active. */
  'sync.status.disconnected': 'Disconnected',
  /** Event log entry when the provider marks the local room active. */
  'sync.event.connected': 'Room is active',
  /** Event log entry when the provider leaves the active state. */
  'sync.event.disconnected': 'Room disconnected',
  /** Event log entry while joining a room; room id interpolated. */
  'sync.event.joining': (roomId: string) => `Joining room ${roomId}…`,
  /** Event log entry after locally merging the library into the room document. */
  'sync.event.merged': (entities: string, claims: string) =>
    `Merged ${entities} entities, ${claims} claims`,
  /** Toast when joining a room succeeds. */
  'sync.toast.joined': (roomId: string) => `Joined room ${roomId}`,
  /** Fallback message when an error carries no details. */
  'sync.error.unknown': 'Unknown error',
  /** Event log entry when joining fails; error message interpolated. */
  'sync.event.joinFailed': (msg: string) => `Failed to join: ${msg}`,
  /** Toast when joining a room fails; error message interpolated. */
  'sync.toast.joinFailed': (msg: string) => `Failed to join room: ${msg}`,
  /** Event log entry when leaving a room. */
  'sync.event.left': 'Left sync room',
  /** Toast when leaving a room. */
  'sync.toast.left': 'Left sync room',
  /** Event log entry when conflicts require resolution; count interpolated. */
  'sync.event.conflictsFound': (count: string) =>
    `Found ${count} conflict(s) requiring resolution`,

  /** Label for a conflict between an edit and a record deletion. */
  'sync.conflict.recordDeletion': 'Record deletion',
  /** Choice that keeps the edited record after a concurrent deletion. */
  'sync.conflict.restoreEditedRecord': 'Restore edited record',
  /** Choice that keeps the deletion after a concurrent edit. */
  'sync.conflict.keepDeletion': 'Keep deletion',
  /** Detail panel label for the record side of a deletion conflict. */
  'sync.conflict.editedRecord': 'Edited record',
  /** Detail panel label for the deletion side of a deletion conflict. */
  'sync.conflict.deletion': 'Deletion',
  /** Value shown for a deletion conflict. */
  'sync.conflict.deleted': 'Deleted',
  /** Bulk choice for a list containing only deletion conflicts. */
  'sync.conflict.restoreAllEditedRecords': 'Restore all edited records',
  /** Bulk choice for a list containing only deletion conflicts. */
  'sync.conflict.keepAllDeletions': 'Keep all deletions',
  /** Explanation for concurrent edits and deletes. */
  'sync.conflict.concurrentDeleteReason':
    'An edit and a deletion were made independently. Restore the edited record or keep the deletion.',
  /** Event log entry after a clean re-sync. */
  'sync.event.resynced': (entities: string, claims: string) =>
    `Re-synced ${entities} entities, ${claims} claims`,
  /** Toast after a clean re-sync. */
  'sync.toast.resynced': 'Re-synced local data',
  /** Event log entry after conflict resolutions are applied; count interpolated. */
  'sync.event.conflictApplied': (count: string) => `Applied ${count} conflict resolution(s)`,
  /** Event log entry when a manual conflict choice fails validation. */
  'sync.event.conflictApplyFailed': 'Conflict choices could not be validated or committed',
  /** Toast after conflict resolutions are applied; count interpolated. */
  'sync.toast.conflictApplied': (count: string) => `Applied ${count} conflict resolution(s)`,
  /** Toast when a room id is scanned from a QR code. */
  'sync.toast.scannedRoom': (roomId: string) => `Scanned room: ${roomId}`,
  /** Summary of the sync protection-limits disclosure. */
  'sync.security.title': 'What room encryption protects',
  /** Signaling metadata visible to the relay. */
  'sync.security.protection':
    'The password encrypts signaling messages and the payloads exchanged between peers. The signaling service still sees the room name, connection timing, message sizes, and your IP address.',
  /** Peer identity limitation. */
  'sync.security.identity':
    'A room password is not peer identity verification. Anyone with the room ID and password can join and edit the shared document.',
  /** Invitation hygiene. */
  'sync.security.invite':
    'Share the room ID over a private channel and send the password separately. QR codes contain only the room ID, never the password.',
  /** Revocation guidance. */
  'sync.security.revocation':
    'To revoke access, leave the room and create a new random room ID. There is no server-side room deletion.',
  /** Room-key fingerprint line; fingerprint interpolated. */
  'sync.security.fingerprint': (fingerprint: string) => `Room key fingerprint: ${fingerprint}`,
  /** Explanation of the fingerprint's limited guarantee. */
  'sync.security.fingerprintHelp':
    'Compare this over a separate channel to catch a password typo. It proves both sides derived the same key, not who the peer is.',
  /** Toast when an invitation token has expired. */
  'sync.toast.inviteExpired': 'That invitation has expired. Ask for a fresh room ID.',
  /** Toast when an invitation token is malformed. */
  'sync.toast.inviteMalformed': 'That invitation is not valid.',

  /** Heading of the file-based sync fallback panel. */
  'syncFile.title': 'Sync via file',
  /** Explanation of the file-based fallback. */
  'syncFile.description':
    'When a network blocks peer-to-peer connections, exchange a bundle file instead. Importing merges records and surfaces conflicts; it never replaces your library.',
  /** Label for the room id used to bind a bundle. Distinct from the live room field. */
  'syncFile.roomId': 'Bundle room ID',
  /** Placeholder for the room id field. */
  'syncFile.roomIdPlaceholder': 'Room ID shared with the other device',
  /** Label for the optional bundle passphrase. */
  'syncFile.password': 'Passphrase (optional)',
  /** Hint that the passphrase must match on both devices. */
  'syncFile.passwordHint': 'Use the same passphrase on both devices. Leave empty for an unencrypted bundle.',
  /** Export button label. */
  'syncFile.export': 'Export bundle',
  /** Import button label. */
  'syncFile.import': 'Import bundle',
  /** Label for the bundle file picker. */
  'syncFile.file': 'Bundle file',
  /** Toast after a bundle is written. */
  'syncFile.exported': (name: string) => `Exported ${name}`,
  /** Toast after a bundle is merged; counts interpolated. */
  'syncFile.imported': (entities: string, claims: string) =>
    `Merged ${entities} entities, ${claims} claims from the bundle`,
  /** Toast when a bundle merges with conflicts; count interpolated. */
  'syncFile.importedWithConflicts': (count: string) =>
    `Merged the bundle with ${count} conflict(s) to resolve`,
  /** Error when the bundle file is too large. */
  'syncFile.error.tooLarge': 'That bundle is too large to import.',
  /** Error when the bundle is not valid JSON. */
  'syncFile.error.invalidJson': 'That file is not a valid sync bundle.',
  /** Error when the file is not a sync bundle. */
  'syncFile.error.unsupportedFormat': 'That file is not a DO Knowledge Studio sync bundle.',
  /** Error when the bundle version is newer than this app supports. */
  'syncFile.error.unsupportedVersion': 'That bundle was written by a newer version of the app.',
  /** Error when an encrypted bundle is imported without a passphrase. */
  'syncFile.error.passwordRequired': 'This bundle is encrypted. Enter its passphrase.',
  /** Error when decryption fails. */
  'syncFile.error.decryptFailed':
    'Could not decrypt the bundle. Check the passphrase and that it came from the same room.',
  /** Error when a record in the bundle fails validation. */
  'syncFile.error.invalidRecords': (detail: string) =>
    `The bundle contains invalid records: ${detail}`,
  /** Error when the bundle cannot be read from disk. */
  'syncFile.error.readFailed': 'Could not read that file.',
  /** Error when the merged state cannot be committed. */
  'syncFile.error.commitFailed': 'The merged bundle could not be saved.',
  /** Error when the room id is empty on export. */
  'syncFile.error.roomRequired': 'Enter a room ID before exporting.',
} as const

/** Typed `translate` helper bound to the sync view message scope. */
export const translate = makeT(messages)