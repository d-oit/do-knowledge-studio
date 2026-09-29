/**
 * Shared typing for the studio store slices (Plan 157 Phase 3).
 *
 * `StateCreator<S, [], [], S>` forces a slice to declare the *entire* store
 * type, which makes composition a type error by construction. `StudioSlice`
 * instead accepts the subset a slice owns while still typing `get()` as the
 * full store, so a slice can call actions another slice provides without
 * importing it (and without an import cycle back into `store.ts`).
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
