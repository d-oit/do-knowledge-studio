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
import { recordDeletions, getDeletions, resetDeletions } from './cross-tab-tombstones'
import { jsonChanged, mergeCorpus, removedIds, type CorpusMerge } from './cross-tab-merge'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from './schema'
import { snapshotCorpus } from './history-snapshot'
import { isSyncBlocked } from './hydration-guard'

// `initCrossTabSync` is not called under a refusal (see store.ts), but a manual
// `rehydrate()` can refuse *after* these listeners were attached, so the
// guards below cannot assume the subscriptions were never created.

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
/** Teardown for a subscription deferred until hydration finishes. */
let pendingHydrationUnsubscribe: (() => void) | null = null
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
    // Claims ride along so the baseline is a complete corpus snapshot.
    patch.entityHistory = [snapshotCorpus(merge.entities, merge.claims)]
    patch.historyIndex = 0
  }
  setGraphIfChanged(patch, current.graph, remote.graph)
  setMindMapIfChanged(patch, current.mindMap, remote.mindMap)
  setLinksIfChanged(patch, current.links, remote.links)
  setTagsIfChanged(patch, current.tags, remote.tags)
  return patch
}

/**
 * Applies a validated remote slice; returns whether the store was updated.
 *
 * This is the single choke point for every inbound corpus, so the refusal
 * guard lives here rather than in each caller: a refused-hydration tab must
 * not merge a peer's real library into its temporary seed workspace.
 */
const applyRemoteMessage = (
  payload: unknown,
  origin: string | undefined,
  deletedEntities: ReadonlyMap<string, number>,
  deletedClaims: ReadonlyMap<string, number>,
): boolean => {
  if (origin === TAB_ORIGIN_ID || isSyncBlocked()) {
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
    deletedEntities,
    deletedClaims,
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

/**
 * Processes a validated incoming remote slice and merges it into the local store.
 * The refusal guard lives in {@link applyRemoteMessage}, the single choke point
 * every inbound corpus passes through.
 */
export const applyRemoteEnvelope = (payload: unknown, origin?: string): boolean =>
  applyRemoteMessage(payload, origin, getDeletions('entity'), getDeletions('claim'))

/**
 * Broadcasts the current persisted slice plus locally-deleted ids to other tabs.
 * Guarded here, not at the subscribe site, because a manual `rehydrate()` can
 * refuse long after that subscription was attached.
 */
const broadcastLocalStoreChange = (
  state: StoreSnapshot,
  deleted: { deletedEntityIds: readonly string[]; deletedClaimIds: readonly string[] },
): void => {
  if (isSyncBlocked() || isApplyingRemoteUpdate || broadcastChannel === null) {
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

/** Records a deletion list after validating every entry is a string id. */
const recordDeletionsIfAny = (kind: 'entity' | 'claim', ids: unknown, timestamp: number): void => {
  const safeIds = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  if (safeIds.length > 0) {
    recordDeletions(kind, safeIds, timestamp)
  }
}

/** Records this message's deletions into the session tombstone registry. */
const recordMessageDeletions = (message: CrossTabMessage): void => {
  const messageTime = message.timestamp ?? Date.now()
  recordDeletionsIfAny('entity', message.deletedEntityIds, messageTime)
  recordDeletionsIfAny('claim', message.deletedClaimIds, messageTime)
}

/** Handles one inbound `BroadcastChannel` message. */
const handleChannelMessage = (message: CrossTabMessage): void => {
  const { origin, payload } = message
  if (payload === undefined) {
    return
  }
  // Deletions are recorded BEFORE the refusal guard in `applyRemoteMessage`.
  // The tombstone registry is session bookkeeping about what a peer deleted;
  // a refused-hydration tab still has to track it, or a stale item could
  // reappear in a later merge.
  recordMessageDeletions(message)
  // The aggregated registry (not just this message's lists) guards later
  // snapshots from stale tabs that still hold previously deleted items.
  applyRemoteMessage(payload, origin, getDeletions('entity'), getDeletions('claim'))
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
  // A deferred subscription must be cancelled too, or it would attach after
  // teardown and leak a listener that broadcasts into a closed channel.
  if (pendingHydrationUnsubscribe) {
    pendingHydrationUnsubscribe()
    pendingHydrationUnsubscribe = null
  }
  if (storageEventListener && typeof window !== 'undefined') {
    window.removeEventListener('storage', storageEventListener)
    storageEventListener = null
  }
  if (broadcastChannel) {
    broadcastChannel.close()
    broadcastChannel = null
  }
  resetDeletions()
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

  const broadcastLocalChanges = (state: StoreSnapshot, previous: StoreSnapshot) => {
    // A seed workspace must not be published, and its diffs must not enter the
    // tombstone registry either. Re-checked per change because a manual
    // rehydrate can refuse after this attached.
    if (isSyncBlocked() || isApplyingRemoteUpdate) {
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
    recordDeletions('entity', deletedEntityIds, Date.now())
    recordDeletions('claim', deletedClaimIds, Date.now())
    broadcastLocalStoreChange(state, { deletedEntityIds, deletedClaimIds })
  }

  // Gate the broadcast subscription on hydration finishing.
  //
  // `initCrossTabSync` is reached through a dynamic import, so the listener can
  // attach AFTER `persist` has already swapped in the stored corpus. The
  // subscription then diffs the hydrated state against the seed it replaced
  // and broadcasts the whole recovered library as if the user had just made
  // that edit — rewriting it in every other tab.
  //
  // Waiting for `onFinishHydration` makes the ordering explicit rather than
  // incidental. Already-hydrated stores attach immediately, so a manual
  // `rehydrate()` in tests is not silently ignored.
  const persist = useStudioStore.persist
  if (persist?.onFinishHydration && !persist.hasHydrated?.()) {
    pendingHydrationUnsubscribe = persist.onFinishHydration(() => {
      pendingHydrationUnsubscribe = null
      unsubscribeStore = useStudioStore.subscribe(broadcastLocalChanges)
    })
  } else {
    unsubscribeStore = useStudioStore.subscribe(broadcastLocalChanges)
  }

  return stopCrossTabSync
}