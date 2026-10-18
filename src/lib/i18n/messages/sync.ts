/**
 * Sync view i18n messages (N5).
 *
 * User-facing strings for `sync-view.tsx`: headings, the sync event log
 * (rendered in the Sync History panel), and toasts. The `SyncStatusCard`
 * component in `sync-helpers.tsx` has its own strings owned elsewhere.
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
  /** Event log entry when the signaling connection is established. */
  'sync.event.connected': 'Connected to signaling server',
  /** Event log entry when the signaling connection drops. */
  'sync.event.disconnected': 'Disconnected from signaling server',
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
} as const

/** Typed `translate` helper bound to the sync view message scope. */
export const translate = makeT(messages)