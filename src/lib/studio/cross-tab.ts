/**
 * Cross-tab store coordination module (Plan 134 F4 / ADR 028).
 *
 * Listens for cross-tab state updates via `BroadcastChannel` and window `storage`
 * events. Incoming persistence envelopes are re-validated with {@link sanitizeHydration}
 * and merged field-by-field using {@link mergeEntities} and {@link mergeClaims}
 * to prevent LWW whole-blob clobbering when multiple tabs edit the same corpus.
 */

import { useStudioStore } from './store'
import { STUDIO_STORAGE_KEY, sanitizeHydration, partializePersistedState } from './hydration'
import { mergeEntities, mergeClaims } from '../sync/merge'
import type { Entity, Claim } from './types'

/** BroadcastChannel name for cross-tab store synchronization. */
export const STUDIO_CROSS_TAB_CHANNEL = 'do-knowledge-studio-crosstab'

/** Unique identifier generated per tab window instance to prevent self-echoes. */
export const TAB_ORIGIN_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2)

let broadcastChannel: BroadcastChannel | null = null
let unsubscribeStore: (() => void) | null = null
let storageEventListener: ((event: StorageEvent) => void) | null = null
let isApplyingRemoteUpdate = false

/** Returns whether a remote cross-tab update is currently being applied to the store. */
export const getIsApplyingRemoteUpdate = (): boolean => isApplyingRemoteUpdate

function areEntitiesEqual(a: Entity[], b: Entity[]): boolean {
  if (a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function areClaimsEqual(a: Claim[], b: Claim[]): boolean {
  if (a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Processes a validated incoming remote slice and merges it into the local store. */
export function applyRemoteEnvelope(payload: unknown, origin?: string): boolean {
  if (origin === TAB_ORIGIN_ID) {
    return false
  }

  const verdict = sanitizeHydration(payload)
  if (!verdict.ok) {
    return false
  }

  const current = useStudioStore.getState()
  const remoteEntities = verdict.data.entities ?? []
  const remoteClaims = verdict.data.claims ?? []

  const entityResult = mergeEntities(current.entities, remoteEntities)
  const claimResult = mergeClaims(current.claims, remoteClaims)

  const entitiesChanged = !areEntitiesEqual(current.entities, entityResult.merged)
  const claimsChanged = !areClaimsEqual(current.claims, claimResult.merged)

  if (!entitiesChanged && !claimsChanged) {
    return false
  }

  isApplyingRemoteUpdate = true
  try {
    useStudioStore.setState({
      entities: entityResult.merged,
      claims: claimResult.merged,
      entityHistory: [entityResult.merged.map((e) => ({ ...e }))],
      historyIndex: 0,
      ...(verdict.data.graph !== undefined ? { graph: verdict.data.graph } : {}),
      ...(verdict.data.mindMap !== undefined ? { mindMap: verdict.data.mindMap } : {}),
      ...(verdict.data.links !== undefined ? { links: verdict.data.links } : {}),
      ...(verdict.data.tags !== undefined ? { tags: verdict.data.tags } : {}),
    })
    return true
  } finally {
    isApplyingRemoteUpdate = false
  }
}

/** Broadcasts the current persisted slice to other tabs. */
function broadcastLocalStoreChange(state: ReturnType<typeof useStudioStore.getState>): void {
  if (isApplyingRemoteUpdate) return
  if (!broadcastChannel) return

  try {
    const payload = partializePersistedState(state)
    broadcastChannel.postMessage({
      origin: TAB_ORIGIN_ID,
      payload,
      timestamp: Date.now(),
    })
  } catch (err) {
    console.warn('Failed to broadcast cross-tab store update:', err)
  }
}

/**
 * Initializes cross-tab store coordination.
 *
 * Subscribes to `BroadcastChannel` and `window` 'storage' events, as well as
 * local Zustand store updates, maintaining passive field-level sync across tabs.
 */
export function initCrossTabSync(): () => void {
  stopCrossTabSync()

  if (typeof window === 'undefined') {
    return () => undefined
  }

  // Setup BroadcastChannel if supported
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(STUDIO_CROSS_TAB_CHANNEL)
      broadcastChannel.onmessage = (event: MessageEvent<{ origin?: string; payload?: unknown }>) => {
        if (!event.data || typeof event.data !== 'object') return
        const { origin, payload } = event.data
        if (payload) {
          applyRemoteEnvelope(payload, origin)
        }
      }
    } catch {
      broadcastChannel = null
    }
  }

  // Setup window 'storage' listener
  storageEventListener = (event: StorageEvent) => {
    if (event.key !== STUDIO_STORAGE_KEY || !event.newValue) return
    try {
      const parsed = JSON.parse(event.newValue)
      // Zustand persist wraps data in { state, version }
      const payload = parsed && typeof parsed === 'object' && 'state' in parsed ? parsed.state : parsed
      applyRemoteEnvelope(payload)
    } catch {
      // Ignore unparseable storage events
    }
  }
  window.addEventListener('storage', storageEventListener)

  // Subscribe to local Zustand store changes
  let prevEntities = useStudioStore.getState().entities
  let prevClaims = useStudioStore.getState().claims

  unsubscribeStore = useStudioStore.subscribe((state) => {
    if (isApplyingRemoteUpdate) return
    if (state.entities !== prevEntities || state.claims !== prevClaims) {
      prevEntities = state.entities
      prevClaims = state.claims
      broadcastLocalStoreChange(state)
    }
  })

  return stopCrossTabSync
}

/** Tears down cross-tab store listeners and channels. */
export function stopCrossTabSync(): void {
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
