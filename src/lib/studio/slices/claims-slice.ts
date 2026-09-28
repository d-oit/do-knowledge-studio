/**
 * Claim CRUD slice (Plan 157 Phase 3, closes D1.6).
 *
 * Claim mutations previously bypassed history entirely, so a claim edit could
 * neither be undone on its own nor be preserved when an entity edit was undone.
 * Routing every claim write through `pushHistory` makes claims first-class
 * history participants, and `addClaims` keeps a bulk extract to one step.
 */
import type { Claim } from '../types'
import type { StudioState } from '../store-types'
import type { StudioSlice } from './slice-types'

/** Keys owned by the claim CRUD slice. */
export type ClaimsSlice = Pick<StudioState, 'addClaim' | 'addClaims' | 'updateClaim' | 'deleteClaim'>

/** Generates a new UUID for entities, claims, and chat messages. */
export const generateId = (): string => crypto.randomUUID()

/** Materializes a draft claim into a full, versioned record. */
const buildClaim = (claim: Omit<Claim, 'id'>): Claim => {
  const now = new Date().toISOString()
  return {
    ...claim,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    version: 1,
    editHistory: [],
  }
}

/** Applies an update, recording a history row when the statement changes. */
const applyClaimUpdate = (claim: Claim, updates: Partial<Omit<Claim, 'id' | 'entityId'>>): Claim => {
  const now = new Date().toISOString()
  const historyEntry =
    updates.statement && updates.statement !== claim.statement
      ? { statement: claim.statement, editedAt: claim.updatedAt ?? now }
      : null
  return {
    ...claim,
    ...updates,
    updatedAt: now,
    version: (claim.version ?? 1) + 1,
    editHistory: historyEntry
      ? [...(claim.editHistory ?? []), historyEntry]
      : claim.editHistory ?? [],
  }
}

/** Builds the claim slice of the studio store. */
export const createClaimsSlice: StudioSlice<ClaimsSlice> = (set, get) => ({
  addClaim: (claim) => {
    set((state) => ({ claims: [buildClaim(claim), ...state.claims] }))
    get().pushHistory()
  },

  addClaims: (drafts) => {
    if (drafts.length === 0) return
    set((state) => ({ claims: [...drafts.map(buildClaim), ...state.claims] }))
    get().pushHistory()
  },

  updateClaim: (id, updates) => {
    set((state) => ({
      claims: state.claims.map((claim) => (claim.id === id ? applyClaimUpdate(claim, updates) : claim)),
    }))
    get().pushHistory()
  },

  deleteClaim: (id) => {
    set((state) => ({ claims: state.claims.filter((claim) => claim.id !== id) }))
    get().pushHistory()
  },
})
