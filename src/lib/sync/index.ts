export {
  entityToYMap,
  ymapToEntity,
  claimToYMap,
  ymapToClaim,
  createSyncDoc,
} from './types'
export type { SyncDoc, SyncMeta, SyncLifecycleState } from './types'

export {
  getDoc,
  getSyncDoc,
  initPersistence,
  isPersistenceSynced,
  ensurePersistenceReady,
  joinRoom,
  reconnectRoom,
  getProvider,
  getCurrentRoomId,
  getAwareness,
  leaveRoom,
  destroy,
} from './doc'
export type { RoomProvider, RoomJoinOptions } from './doc'

export {
  ICE_URL_SCHEMES,
  MAX_ICE_SERVERS,
  MAX_ICE_URLS_PER_SERVER,
  DEFAULT_ICE_SERVERS,
  validateIceServers,
  redactIceServers,
  toRtcIceServers,
  sameIceServers,
  parseIceServersEnv,
} from './ice-config'
export type {
  IceServerConfig,
  IceConfigIssue,
  IceConfigIssueCode,
  IceConfigResult,
  RedactedIceServer,
} from './ice-config'

export { loadIceServerSettings, saveIceServerSettings } from './ice-settings'

export {
  SYNC_SELF_HOSTING_DOC_URL,
  collectSyncConnectionSnapshot,
  deriveConnectionHint,
  toCandidateKind,
} from './diagnostics'
export type {
  IceCandidateKind,
  SyncConnectionHint,
  SyncConnectionSnapshot,
} from './diagnostics'

export {
  getYjsEntities,
  getYjsClaims,
  setYjsEntity,
  removeYjsEntity,
  setYjsClaim,
  removeYjsClaim,
  mergeIntoYjs,
  destroyBridge,
  initSync,
} from './bridge'
export {
  addTombstone,
  isTombstoned,
  getTombstone,
  getAllTombstones,
} from './tombstones'
export type { Tombstone } from './tombstones'
