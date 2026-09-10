/**
 * Sync view i18n messages (N5).
 *
 * User-facing strings for `sync-view.tsx`: headings, the sync event log
 * (rendered in the Sync History panel), and toasts. The `SyncStatusCard`
 * component in `sync-helpers.tsx` has its own strings owned elsewhere.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Sync view heading. */
  'sync.title': 'Sync',
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
  /** Event log entry after a clean re-sync. */
  'sync.event.resynced': (entities: string, claims: string) =>
    `Re-synced ${entities} entities, ${claims} claims`,
  /** Toast after a clean re-sync. */
  'sync.toast.resynced': 'Re-synced local data',
  /** Event log entry after conflict resolutions are applied; count interpolated. */
  'sync.event.conflictApplied': (count: string) => `Applied ${count} conflict resolution(s)`,
  /** Toast after conflict resolutions are applied; count interpolated. */
  'sync.toast.conflictApplied': (count: string) => `Applied ${count} conflict resolution(s)`,
  /** Toast when a room id is scanned from a QR code. */
  'sync.toast.scannedRoom': (roomId: string) => `Scanned room: ${roomId}`,
} as const

/** Typed `translate` helper bound to the sync view message scope. */
export const translate = makeT(messages)