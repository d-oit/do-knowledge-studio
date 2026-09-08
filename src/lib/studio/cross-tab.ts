// skipcq: JS-R1005 -- cross-tab coordination helpers have intentional medium complexity for message handling
/**
 * Cross-tab store coordination module (Plan 134 F4 / ADR 028).
 *
 * Listens for cross-tab state updates via `BroadcastChannel` and window `storage`
 * events. Incoming persistence envelopes are re-validated with
 * {@link sanitizeHydration} and merged field-by-field using {@link mergeEntities}
 * and {@link mergeClaims} to prevent LWW whole-blob clobbering when multiple
 * tabs edit the same corpus.
 *
 * Deletions propagate over `BroadcastChannel` through per-message deleted-id
 * lists: each broadcast diffs the local change and carries the ids that just
 * disappeared, and a receiving tab drops those ids (unless the local item was
 * updated after the broadcast was sent). Plain `storage` snapshots carry no
 * tombstones — an absent id is indistinguishable from one never seen — so they
 * union-merge and never resurrect items deleted in the sender.
 *
 * Canvas fields (graph / mindMap / links / tags) broadcast with `null` as an
 * explicit "cleared" sentinel: Zod strips `undefined` optional keys during
 * sanitization, which would otherwise make a reset/import clear
 * indistinguishable from an omitted field.
 */

import { useStudioStore } from './store'
import { STUDIO_STORAGE_KEY, sanitizeHydration, partializePersistedState } from './hydration'
import { mergeEntities, mergeClaims } from '../sync/merge'
import { recordDeletions, getDeletions } from './cross-tab-tombstones'
import type { Entity, Claim } from './types'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from './schema'

/** BroadcastChannel name for cross-tab store synchronization. */
export const STUDIO_CROSS_TAB_CHANNEL = 'do-knowledge-studio-crosstab'

/** Optional canvas fields a remote envelope may carry alongside the corpus. */
interface RemoteCanvasFields {
  graph?: ValidatedGraph | null
  mindMap?: ValidatedMindMap | null
  links?: ValidatedLink[] | null
  tags?: ValidatedTag[] | null
}

/** Payload broadcast to other tabs by {@link initCrossTabSync}. */
interface CrossTabMessage {
  origin?: string
  payload?: unknown
  /** Send time (ms epoch) used to arbitrate re-created items against deletions. */
  timestamp?: number
  /** Ids deleted from the sender's corpus by the change being broadcast. */
  deletedEntityIds?: readonly string[]
  deletedClaimIds?: readonly string[]
}

/** Shape of the studio store state as read through {@link useStudioStore}. */
type StoreSnapshot = ReturnType<typeof useStudioStore.getState>

let broadcastChannel: BroadcastChannel | null = null
let unsubscribeStore: (() => void) | null = null
let storageEventListener: ((event: StorageEvent) => void) | null = null
let isApplyingRemoteUpdate = false
let fallbackOriginCounter = 0

/** Returns whether a remote cross-tab update is currently being applied to the store. */
export const getIsApplyingRemoteUpdate = (): boolean => isApplyingRemoteUpdate

/**
 * Builds a per-tab-session origin id without `Math.random`: prefers Web Crypto
 * `randomUUID`, falls back to `getRandomValues`, then to a timestamp plus a
 * monotonic counter for non-secure contexts without Web Crypto.
 */
const generateTabOriginId = (): string => {
  const webCrypto = globalThis.crypto
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const randomValues = new Uint32Array(4)
    webCrypto.getRandomValues(randomValues)
    return Array.from(randomValues, (value) => value.toString(16).padStart(8, '0')).join('-')
  }
  fallbackOriginCounter += 1
  const nowMs = typeof performance !== 'undefined' ? performance.now() : 0
  return `${Date.now().toString(36)}-${Math.floor(nowMs).toString(36)}-${fallbackOriginCounter.toString(36)}`
}

/** Unique identifier generated per tab window instance to prevent self-echoes. */
export const TAB_ORIGIN_ID = generateTabOriginId()

/** Structural equality for persisted arrays (objects compare by serialized value). */
const arraysEqual = (left: readonly unknown[], right: readonly unknown[]): boolean =>
  left.length === right.length && JSON.stringify(left) === JSON.stringify(right)

/** Structural inequality for a single optional persisted field.
 * `null` is the explicit "cleared" sentinel used by broadcasts; `undefined`
 * means the sender omitted the field (no update). */
const jsonChanged = <T,>(local: T | undefined, remote: T | null | undefined): boolean => {
  if (remote === undefined) return false
  const localJson = local === undefined ? null : JSON.stringify(local)
  const remoteJson = remote === null ? null : JSON.stringify(remote)
  return localJson !== remoteJson
}

/** Ids of items present in `previous` but absent in `next` (the local deletions). */
const removedIds = <T extends { id: string }>(previous: readonly T[], next: readonly T[]): string[] => {
  const nextIds = new Set(next.map((item) => item.id))
  const removed: string[] = []
  for (const item of previous) {
    if (!nextIds.has(item.id)) {
      removed.push(item.id)
    }
  }
  return removed
}

/** Whether an item was last written after the given delete-broadcast time. */
const updatedAfter = (item: { updatedAt?: string; createdAt?: string }, timestamp: number): boolean => {
  const lastWrite = item.updatedAt ?? item.createdAt
  if (!lastWrite) return false
  const parsed = Date.parse(lastWrite)
  return !Number.isNaN(parsed) && parsed > timestamp
}

/** Drops items a deletion map says were removed, unless re-created after the tombstone. */
const withoutRemoteDeletes = <T extends { id: string; updatedAt?: string; createdAt?: string }>(
  items: readonly T[],
  deletedById: ReadonlyMap<string, number>,
): T[] => {
  if (deletedById.size === 0) {
    return [...items]
  }
  return items.filter((item) => {
    const deletedAt = deletedById.get(item.id)
    return deletedAt === undefined || updatedAfter(item, deletedAt)
  })
}

/** Outcome of a corpus merge: merged lists plus per-list change flags. */
interface CorpusMerge {
  entities: Entity[]
  claims: Claim[]
  entitiesChanged: boolean
  claimsChanged: boolean
}

/** Field-level merge of the remote corpus against local state, deletions applied. */
const mergeCorpus = (
  currentEntities: readonly Entity[],
  currentClaims: readonly Claim[],
  remoteEntities: readonly Entity[],
  remoteClaims: readonly Claim[],
  deletedById: ReadonlyMap<string, number>,
): CorpusMerge => {
  // Deletions apply to both sides: local items the map tombstoned are dropped,
  // and remote items from a stale snapshot that were already deleted (unless
  // re-created after the tombstone) must not re-enter through the merge union.
  const localEntities = withoutRemoteDeletes(currentEntities, deletedById)
  const localClaims = withoutRemoteDeletes(currentClaims, deletedById)
  const remoteSurvivors = withoutRemoteDeletes(remoteEntities, deletedById)
  const remoteClaimSurvivors = withoutRemoteDeletes(remoteClaims, deletedById)
  const mergedEntities = mergeEntities([...localEntities], [...remoteSurvivors]).merged
  const mergedClaims = mergeClaims([...localClaims], [...remoteClaimSurvivors]).merged
  // Preserve the no-dangling-claims invariant that deleteEntity enforces
  // locally (ADR 028): a claim whose entity was removed by the same remote
  // deletion — and is absent from both merge sides — cannot survive, or the
  // receiving tab ends up with an entityId that no longer exists anywhere.
  const deletedEntitySet = new Set(deletedById.keys())
  const survivingEntityIds = new Set(mergedEntities.map((entity) => entity.id))
  const survivingClaims = mergedClaims.filter(
    (claim) => !deletedEntitySet.has(claim.entityId) || survivingEntityIds.has(claim.entityId),
  )
  return {
    entities: mergedEntities,
    claims: survivingClaims,
    entitiesChanged: !arraysEqual(currentEntities, mergedEntities),
    claimsChanged: !arraysEqual(currentClaims, survivingClaims),
  }
}

/** Whether any optional canvas field in the remote envelope differs from local. */
const canvasFieldsChanged = (current: StoreSnapshot, remote: RemoteCanvasFields): boolean =>
  jsonChanged(current.graph, remote.graph) ||
  jsonChanged(current.mindMap, remote.mindMap) ||
  jsonChanged(current.links, remote.links) ||
  jsonChanged(current.tags, remote.tags)
/** Whether any canvas field changed reference between two local snapshots. */
const canvasChanged = (previous: StoreSnapshot, next: StoreSnapshot): boolean =>
  previous.graph !== next.graph ||
  previous.mindMap !== next.mindMap ||
  previous.links !== next.links ||
  previous.tags !== next.tags

const setGraphIfChanged = (
  patch: Partial<StoreSnapshot>,
  local: ValidatedGraph | undefined,
  remote: ValidatedGraph | null | undefined,
): void => {
  if (jsonChanged(local, remote)) {
    patch.graph = remote === null ? undefined : remote
  }
}

const setMindMapIfChanged = (
  patch: Partial<StoreSnapshot>,
  local: ValidatedMindMap | undefined,
  remote: ValidatedMindMap | null | undefined,
): void => {
  if (jsonChanged(local, remote)) {
    patch.mindMap = remote === null ? undefined : remote
  }
}

const setLinksIfChanged = (
  patch: Partial<StoreSnapshot>,
  local: ValidatedLink[] | undefined,
  remote: ValidatedLink[] | null | undefined,
): void => {
  if (jsonChanged(local, remote)) {
    patch.links = remote === null ? undefined : remote
  }
}

const setTagsIfChanged = (
  patch: Partial<StoreSnapshot>,
  local: ValidatedTag[] | undefined,
  remote: ValidatedTag[] | null | undefined,
): void => {
  if (jsonChanged(local, remote)) {
    patch.tags = remote === null ? undefined : remote
  }
}

/** Builds the partial store update that applies an accepted remote envelope. */
const buildStatePatch = (
  current: StoreSnapshot,
  merge: CorpusMerge,
  remote: RemoteCanvasFields,
): Partial<StoreSnapshot> => {
  const patch: Partial<StoreSnapshot> = {}
  const corpusChanged = merge.entitiesChanged || merge.claimsChanged
  if (merge.entitiesChanged) {
    patch.entities = merge.entities
  }
  if (merge.claimsChanged) {
    patch.claims = merge.claims
  }
  if (corpusChanged) {
    // Rebase the undo baseline so a remote apply can never be undone away.
    patch.entityHistory = [merge.entities.map((entity) => ({ ...entity }))]
    patch.historyIndex = 0
  }
  setGraphIfChanged(patch, current.graph, remote.graph)
  setMindMapIfChanged(patch, current.mindMap, remote.mindMap)
  setLinksIfChanged(patch, current.links, remote.links)
  setTagsIfChanged(patch, current.tags, remote.tags)
  return patch
}

/** Applies a validated remote slice; returns whether the store was updated. */
const applyRemoteMessage = (
  payload: unknown,
  origin: string | undefined,
  deletedById: ReadonlyMap<string, number>,
): boolean => {
  if (origin === TAB_ORIGIN_ID) {
    return false
  }

  const verdict = sanitizeHydration(payload)
  if (!verdict.ok) {
    return false
  }

  const current = useStudioStore.getState()
  const merge = mergeCorpus(
    current.entities,
    current.claims,
    verdict.data.entities ?? [],
    verdict.data.claims ?? [],
    deletedById,
  )
  const changed = merge.entitiesChanged || merge.claimsChanged || canvasFieldsChanged(current, verdict.data)
  if (!changed) {
    return false
  }

  isApplyingRemoteUpdate = true
  try {
    useStudioStore.setState(buildStatePatch(current, merge, verdict.data))
    return true
  } finally {
    isApplyingRemoteUpdate = false
  }
}

/** Processes a validated incoming remote slice and merges it into the local store. */
export const applyRemoteEnvelope = (payload: unknown, origin?: string): boolean =>
  applyRemoteMessage(payload, origin, getDeletions())

/** Broadcasts the current persisted slice plus locally-deleted ids to other tabs. */
const broadcastLocalStoreChange = (
  state: StoreSnapshot,
  deleted: { deletedEntityIds: readonly string[]; deletedClaimIds: readonly string[] },
): void => {
  if (isApplyingRemoteUpdate || broadcastChannel === null) {
    return
  }

  try {
    const message: CrossTabMessage = {
      origin: TAB_ORIGIN_ID,
      // partializePersistedState already encodes cleared canvas fields as the
      // `null` sentinel, so the raw persisted slice is the broadcast payload.
      payload: partializePersistedState(state),
      timestamp: Date.now(),
      deletedEntityIds: [...deleted.deletedEntityIds],
      deletedClaimIds: [...deleted.deletedClaimIds],
    }
    broadcastChannel.postMessage(message)
  } catch (error) {
    console.warn('Failed to broadcast cross-tab store update:', error)
  }
}

/** Handles one inbound `BroadcastChannel` message. */
const handleChannelMessage = (message: CrossTabMessage): void => {
  const { origin, payload, deletedEntityIds, deletedClaimIds, timestamp } = message
  if (payload === undefined) {
    return
  }
  const deletedIds = [...(deletedEntityIds ?? []), ...(deletedClaimIds ?? [])]
  const messageTime = timestamp ?? Date.now()
  if (deletedIds.length > 0) {
    recordDeletions(deletedIds, messageTime)
  }
  applyRemoteMessage(payload, origin, new Map(deletedIds.map((id) => [id, messageTime])))
}

/** Attaches the `BroadcastChannel` listener that receives remote envelopes. */
const setupBroadcastChannel = (): void => {
  if (typeof BroadcastChannel === 'undefined') {
    return
  }
  try {
    broadcastChannel = new BroadcastChannel(STUDIO_CROSS_TAB_CHANNEL)
    broadcastChannel.onmessage = (event: MessageEvent<CrossTabMessage>) => {
      if (!event.data || typeof event.data !== 'object') {
        return
      }
      handleChannelMessage(event.data)
    }
  } catch (error) {
    broadcastChannel = null
    console.warn('Failed to open cross-tab BroadcastChannel:', error)
  }
}

/** Unwraps a zustand persist envelope ({ state, version }) if present. */
const unwrapPersistEnvelope = (parsed: unknown): unknown => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed
  }
  if ('state' in parsed) {
    return parsed.state
  }
  return parsed
}

/** Builds the listener that applies localStorage writes from other tabs. */
const createStorageEventListener = (): ((event: StorageEvent) => void) => {
  return (event: StorageEvent) => {
    if (event.key !== STUDIO_STORAGE_KEY || event.newValue === null) {
      return
    }
    try {
      const parsed: unknown = JSON.parse(event.newValue)
      applyRemoteEnvelope(unwrapPersistEnvelope(parsed))
    } catch (error) {
      // A cross-tab write can be observed mid-flight; the next write (or the
      // BroadcastChannel message for the same change) carries the full state.
      console.warn('Ignored unreadable cross-tab storage event:', error)
    }
  }
}

/** Tears down cross-tab store listeners and channels. */
export const stopCrossTabSync = (): void => {
  if (unsubscribeStore) {
    unsubscribeStore()
    unsubscribeStore = null
  }
  if (storageEventListener && typeof window !== 'undefined') {
    window.removeEventListener('storage', storageEventListener)
    storageEventListener = null
  }
  if (broadcastChannel) {
    broadcastChannel.close()
    broadcastChannel = null
  }
}

/**
 * Initializes cross-tab store coordination.
 *
 * Subscribes to `BroadcastChannel` and `window` 'storage' events, as well as
 * local Zustand store updates, maintaining passive field-level sync across tabs.
 */
export const initCrossTabSync = (): (() => void) => {
  stopCrossTabSync()

  if (typeof window === 'undefined') {
    return () => undefined
  }

  setupBroadcastChannel()
  storageEventListener = createStorageEventListener()
  window.addEventListener('storage', storageEventListener)

  // Subscribe to local Zustand store changes. The persisted corpus is diffed
  // against the previous state so deletions ride along with the snapshot.
  unsubscribeStore = useStudioStore.subscribe((state, previous) => {
    if (isApplyingRemoteUpdate) {
      return
    }
    if (
      state.entities === previous.entities &&
      state.claims === previous.claims &&
      !canvasChanged(previous, state)
    ) {
      return
    }
    const deletedEntityIds = removedIds(previous.entities, state.entities)
    const deletedClaimIds = removedIds(previous.claims, state.claims)
    recordDeletions([...deletedEntityIds, ...deletedClaimIds], Date.now())
    broadcastLocalStoreChange(state, { deletedEntityIds, deletedClaimIds })
  })

  return stopCrossTabSync
}