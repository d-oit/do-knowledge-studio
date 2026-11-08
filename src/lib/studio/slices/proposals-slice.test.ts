import { beforeEach, describe, expect, it } from 'vitest'
import { useStudioStore } from '../store'
import type { ClaimProposal, EntityProposal } from '@/lib/synthesis/types'

const makeClaimProposal = (overrides: Partial<ClaimProposal> = {}): ClaimProposal => ({
  kind: 'claim',
  id: 'p-claim',
  noteId: 'note-1',
  noteName: 'Note',
  statement: 'The canonical copy stays local.',
  entityName: null,
  evidence: 'canonical copy',
  confidence: 0.7,
  model: 'test-model',
  provider: 'local',
  createdAt: '2026-03-03T00:00:00.000Z',
  status: 'pending',
  duplicateOf: null,
  ...overrides,
})

const makeEntityProposal = (overrides: Partial<EntityProposal> = {}): EntityProposal => ({
  kind: 'entity',
  id: 'p-entity',
  noteId: 'note-1',
  noteName: 'Note',
  name: 'Local-first software',
  entityType: 'concept',
  description: 'A concept',
  evidence: '',
  confidence: 0.5,
  model: 'test-model',
  provider: 'local',
  createdAt: '2026-03-03T00:00:00.000Z',
  status: 'pending',
  duplicateOf: null,
  ...overrides,
})

const resetStore = () => {
  useStudioStore.setState({
    entities: [],
    claims: [],
    proposals: [],
    entityHistory: [],
    historyIndex: -1,
  })
  useStudioStore.getState().pushHistory()
}

describe('proposal slice', () => {
  beforeEach(resetStore)

  it('stores proposals without touching the corpus', () => {
    useStudioStore.getState().addProposals([makeClaimProposal(), makeEntityProposal()])
    const state = useStudioStore.getState()
    expect(state.proposals).toHaveLength(2)
    expect(state.claims).toHaveLength(0)
    expect(state.entities).toHaveLength(0)
  })

  it('accepts a claim with model provenance and unverified status', () => {
    useStudioStore.getState().addProposals([makeClaimProposal()])
    useStudioStore.getState().acceptProposal('p-claim')
    const state = useStudioStore.getState()
    expect(state.claims).toHaveLength(1)
    expect(state.claims[0]).toMatchObject({
      entityId: 'note-1',
      statement: 'The canonical copy stays local.',
      evidence: 'canonical copy',
      confidence: 0.7,
      verification: 'unverified',
      source: 'ai:test-model',
    })
    expect(state.proposals[0]?.status).toBe('accepted')
  })

  it('accepts an entity proposal into the library', () => {
    useStudioStore.getState().addProposals([makeEntityProposal()])
    useStudioStore.getState().acceptProposal('p-entity')
    const state = useStudioStore.getState()
    expect(state.entities).toHaveLength(1)
    expect(state.entities[0]).toMatchObject({
      name: 'Local-first software',
      type: 'concept',
      description: 'A concept',
    })
  })

  it('ignores a second accept and a rejected proposal', () => {
    useStudioStore.getState().addProposals([
      makeClaimProposal(),
      makeClaimProposal({ id: 'p-rejected' }),
    ])
    useStudioStore.getState().rejectProposal('p-rejected')
    useStudioStore.getState().acceptProposal('p-claim')
    useStudioStore.getState().acceptProposal('p-claim')
    useStudioStore.getState().acceptProposal('p-rejected')
    const state = useStudioStore.getState()
    expect(state.claims).toHaveLength(1)
    expect(state.proposals.find((p) => p.id === 'p-rejected')?.status).toBe('rejected')
  })

  it('undoes an accept in one step, leaving the proposal record', () => {
    useStudioStore.getState().addProposals([makeClaimProposal(), makeEntityProposal()])
    useStudioStore.getState().acceptProposal('p-claim')
    useStudioStore.getState().acceptProposal('p-entity')
    expect(useStudioStore.getState().claims).toHaveLength(1)
    useStudioStore.getState().undo()
    expect(useStudioStore.getState().entities).toHaveLength(0)
    expect(useStudioStore.getState().proposals).toHaveLength(2)
    useStudioStore.getState().undo()
    expect(useStudioStore.getState().claims).toHaveLength(0)
  })
})
