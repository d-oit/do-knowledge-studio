/**
 * Shared typing for the studio store slices (Plan 157 Phase 3).
 *
 * A slice contributes only the fields it owns, but its `set`/`get` must still
 * be typed against the composed store — `set` because a slice may only write
 * store-shaped state, `get` so a slice can call actions another slice provides
 * without importing it. `StudioSlice<S>` captures exactly that pair: the
 * contributor's subset (`S`) plus full-store access through `get()`. Naming the
 * pair here means a slice never has to import `store.ts` to refer to the store
 * it composes into, which would be an import cycle — `store.ts` imports every
 * slice.
 */
import type { StateCreator } from 'zustand'
import type { StudioState } from '../store-types'

/** The `set`/`get` pair handed to a slice creator. */
type SliceMutators = Parameters<StateCreator<StudioState>>

/**
 * A slice creator contributing the `S` subset of {@link StudioState} to the
 * composed store, with full-store access through `get()`.
 */
export type StudioSlice<S> = (set: SliceMutators[0], get: SliceMutators[1]) => S
