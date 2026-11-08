/**
 * Synthesis proposal slice (#1057).
 *
 * Proposals live in their own slice so the inbox can persist, sync and render
 * without any of it touching `entities` or `claims`. Accepting runs through the
 * existing entity and claim actions, which means a single Undo reverses the
 * accept exactly like a manual edit (ADR 054).
 */
import type { SynthesisProposal } from '@/lib/synthesis/types'
import type { Entity } from '../types'
import type { StudioState } from '../store-types'
import type { StudioSlice } from './slice-types'
import { generateId } from './claims-slice'

/** Keys owned by the proposal slice. */
export type ProposalsSlice = Pick<
  StudioState,
  'proposals' | 'addProposals' | 'acceptProposal' | 'rejectProposal' | 'setProposalStatus'
>

/** Applies a status change to one proposal, leaving the rest untouched. */
const withStatus = (
  proposals: SynthesisProposal[],
  id: string,
  status: SynthesisProposal['status'],
): SynthesisProposal[] =>
  proposals.map((proposal) => (proposal.id === id ? { ...proposal, status } : proposal))

/** Builds the entity an accepted entity proposal creates. */
const toEntity = (proposal: Extract<SynthesisProposal, { kind: 'entity' }>): Entity => {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: proposal.name,
    type: proposal.entityType,
    description: proposal.description,
    content: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    links: [],
  }
}

/** Builds the proposal slice of the studio store. */
export const createProposalsSlice: StudioSlice<ProposalsSlice> = (set, get) => ({
  proposals: [],

  addProposals: (proposals) => {
    if (proposals.length === 0) return
    set((state) => ({ proposals: [...proposals, ...state.proposals] }))
  },

  setProposalStatus: (id, status) => {
    set((state) => ({ proposals: withStatus(state.proposals, id, status) }))
  },

  /**
   * Creates the entity or claim a proposal describes.
   *
   * A non-pending proposal is ignored: accepting twice must not create two
   * records, and a rejected proposal must not be resurrected by a stale click.
   */
  acceptProposal: (id) => {
    const proposal = get().proposals.find((candidate) => candidate.id === id)
    if (proposal === undefined || proposal.status !== 'pending') return
    if (proposal.kind === 'entity') {
      // `commitEntity` pushes one history snapshot, so Undo removes the new
      // entity without touching the proposal record itself.
      get().commitEntity(toEntity(proposal))
    } else {
      get().addClaim({
        entityId: proposal.noteId,
        statement: proposal.statement,
        ...(proposal.evidence === '' ? {} : { evidence: proposal.evidence }),
        confidence: proposal.confidence,
        verification: 'unverified',
        source: `ai:${proposal.model}`,
      })
    }
    set((state) => ({ proposals: withStatus(state.proposals, id, 'accepted') }))
  },

  rejectProposal: (id) => {
    set((state) => ({ proposals: withStatus(state.proposals, id, 'rejected') }))
  },
})
