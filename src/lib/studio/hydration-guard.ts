/**
 * Fail-closed persistence guard for a refused hydration (ADR 028).
 *
 * Preserving refused bytes in a separate key is necessary but not sufficient.
 * The refusal also has to survive the REST of the page session, because the
 * workspace the user is left looking at is a temporary seed state that this
 * build knows nothing about. Two paths could still destroy or misrepresent
 * the data:
 *
 * 1. `setItem(STUDIO_STORAGE_KEY, …)`. Zustand calls this implicitly
 *    whenever `migrate` returns a value, and again on every later `setState`.
 *    A seed write lands on top of the very envelope the code claims to have
 *    preserved. The guard intercepts that one key and drops the write.
 * 2. Cross-tab and Yjs traffic. A seed workspace that broadcasts or accepts
 *    remote updates rewrites a healthy tab's real corpus. Gating only the
 *    localStorage writer would let that happen anyway, so both sync paths
 *    consult the same status.
 *
 * Once a refusal is recorded, the block stays for the lifetime of the page —
 * including across a same-tab `rehydrate()`. A store that rehydrates against
 * quarantined seed data is not a validated hydrate, and only a fresh page load
 * that actually validated an envelope may resume persistence.
 *
 * This module deliberately holds no import of the store, so `store.ts` and
 * `cross-tab.ts` can both depend on it without creating an import cycle.
 */
import type { StateStorage } from 'zustand/middleware'
import { STUDIO_STORAGE_KEY } from './hydration'

/** Why the last hydration attempt refused, and whether a copy is safe. */
export interface HydrationRefusal {
  /** Human-readable reason, safe to show in the UI. */
  reason: string
  /** The refused envelope's bytes, or null when storage could not be read. */
  raw: string | null
  /**
   * True only when the exact refused bytes are known to be preserved — either
   * already in quarantine or just written there. False means the app holds no
   * copy, so edits made in this session cannot be saved.
   */
  preserved: boolean
}

/** Set synchronously inside a refusal branch, before the branch returns. */
let lastRefusal: HydrationRefusal | null = null

/** Latches writes to the store key off for the rest of this page session. */
let writeBlocked = false

/**
 * Notified whenever the refusal status changes.
 *
 * A refusal can land after React has already mounted (a late or manual
 * `rehydrate()`), and the shell's Yjs gate and Sync gate must react to it
 * rather than reading a value captured at mount.
 */
const refusalListeners = new Set<() => void>()

/** The most recent hydration refusal, or null when hydration was accepted. */
export const getHydrationRefusal = (): HydrationRefusal | null => lastRefusal

/**
 * Whether cross-tab and peer traffic must be ignored for this page
 * (ADR 028 §4a).
 *
 * After a refused hydration a tab holds a seed workspace that never contained
 * the user's corpus. Broadcasting it rewrites every healthy tab's real library
 * with the demo set, and applying inbound updates merges that seed state
 * outward. Gating only the localStorage writer would still let both happen, so
 * every entry and exit point consults this one status.
 */
export const isSyncBlocked = (): boolean => lastRefusal !== null

/** Subscribes to refusal status changes; returns an unsubscribe function. */
export const subscribeToHydrationRefusal = (listener: () => void): (() => void) => {
  refusalListeners.add(listener)
  return () => {
    refusalListeners.delete(listener)
  }
}

/**
 * Records a refusal and blocks persistence immediately.
 *
 * The flag is set before this returns because zustand writes the store key
 * synchronously once `migrate` returns — a refusal recorded afterwards would
 * already be one overwrite too late.
 */
export const recordHydrationRefusal = (
  reason: string,
  raw: string | null,
  preserved: boolean,
): void => {
  lastRefusal = { reason, raw, preserved }
  writeBlocked = true
  notifyRefusalListeners()
}

/** Notifies refusal subscribers. Isolated so a throwing listener cannot stop
 *  the others, nor abort the refusal that triggered the notification. */
const notifyRefusalListeners = (): void => {
  for (const listener of refusalListeners) {
    try {
      listener()
    } catch (error) {
      console.error('Hydration refusal listener failed:', error)
    }
  }
}

/**
 * Builds the persist storage wrapper, intercepting writes to the store key
 * while a refusal is active.
 *
 * Only `setItem` for {@link STUDIO_STORAGE_KEY} is intercepted. Reads and
 * removes pass through unchanged, as do writes to any other key — quarantine
 * must stay writable, otherwise the next recovery attempt could not run.
 *
 * Call this inside the `createJSONStorage` getter, not at module scope: that
 * getter is what dereferences `localStorage`, and `createJSONStorage` catches
 * the resulting ReferenceError to fall back to a memory-only store. Moving
 * the dereference to module scope would throw during evaluation on the server
 * instead, taking the whole module graph down.
 */
export const getGuardedStorage = (): StateStorage => {
  // Dereferenced so a server render throws here, where createJSONStorage
  // expects it, rather than deeper inside the hydrate chain.
  void localStorage
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      if (writeBlocked && name === STUDIO_STORAGE_KEY) {
        console.warn(
          'Studio is not saving: your stored library could not be loaded, so the ' +
            'temporary workspace is left in memory only. The refused payload is ' +
            'unchanged on disk.',
        )
        return
      }
      localStorage.setItem(name, value)
    },
    removeItem: (name) => localStorage.removeItem(name),
  }
}
