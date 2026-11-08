import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Entity } from '@/lib/studio/types'
import type { ClaimProposal } from '@/lib/synthesis/types'

const harness = vi.hoisted(() => ({
  state: {
    proposals: [] as unknown[],
    entities: [] as unknown[],
    addProposals: vi.fn(),
    acceptProposal: vi.fn(),
    rejectProposal: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (state: typeof harness.state) => unknown) => selector(harness.state),
}))

vi.mock('sonner', () => ({ toast: harness.toast }))

vi.mock('lucide-react', () => ({
  Inbox: () => <span data-testid="icon-inbox" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Square: () => <span data-testid="icon-square" />,
}))

vi.mock('@/lib/studio/ai-settings', () => ({
  loadAISettings: vi.fn(async () => ({
    provider: 'local',
    model: 'onnx-community/Qwen2.5-0.5B-Instruct',
    apiKey: '',
    augmentWithLocal: true,
    ollamaCpuOnly: true,
    allowWebResearch: false,
    ollamaBaseUrl: 'http://localhost:11434',
    localDevice: 'wasm',
  })),
}))

import { SynthesisInboxPanel } from './synthesis-inbox-panel'

const NOTE: Entity = {
  id: 'note-1',
  name: 'Local-first notes',
  type: 'note',
  description: '',
  content: 'The canonical copy stays on your device.',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
}

const makeProposal = (overrides: Partial<ClaimProposal> = {}): ClaimProposal => ({
  kind: 'claim',
  id: 'p-1',
  noteId: 'note-1',
  noteName: 'Local-first notes',
  statement: 'The canonical copy stays local.',
  entityName: null,
  evidence: 'canonical copy',
  confidence: 0.8,
  model: 'local-model',
  provider: 'local',
  createdAt: '2026-02-02T00:00:00.000Z',
  status: 'pending',
  duplicateOf: null,
  ...overrides,
})

describe('SynthesisInboxPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    harness.state.proposals = []
    harness.state.entities = []
  })

  /**
   * Renders the panel and waits for the settings load to settle.
   *
   * The provider line only renders once `loadAISettings` resolves, so awaiting
   * it keeps the state update inside the test instead of firing after it — the
   * `act(...)` warning that would otherwise be reported as a defect.
   */
  const renderPanel = async (note: Entity) => {
    render(<SynthesisInboxPanel note={note} />)
    await screen.findByText(/not sent anywhere/i)
  }

  it('states that nothing is written until a proposal is accepted', async () => {
    await renderPanel(NOTE)
    expect(screen.getByText(/Nothing is added to your library until you accept it/i)).toBeDefined()
    expect(screen.getByText(/No proposals yet/i)).toBeDefined()
  })

  it('shows the provider, model and local-only privacy note', async () => {
    await renderPanel(NOTE)
    expect(screen.getByText(/Local \(in-browser\)/)).toBeDefined()
    expect(screen.getByText(/not sent anywhere/i)).toBeDefined()
  })

  it('renders only the proposals of the open note', async () => {
    harness.state.proposals = [
      makeProposal(),
      makeProposal({ id: 'other', noteId: 'note-2', statement: 'Unrelated claim' }),
    ]
    await renderPanel(NOTE)
    expect(screen.getByText(/The canonical copy stays local\./)).toBeDefined()
    expect(screen.queryByText(/Unrelated claim/)).toBeNull()
  })

  it('accepts and rejects through the store, and shows a decided status', async () => {
    harness.state.proposals = [
      makeProposal(),
      makeProposal({ id: 'p-2', statement: 'A second claim', status: 'rejected' }),
    ]
    await renderPanel(NOTE)
    fireEvent.click(screen.getByLabelText(/Accept proposal: The canonical copy stays local\./))
    expect(harness.state.acceptProposal).toHaveBeenCalledWith('p-1')
    expect(harness.toast.success).toHaveBeenCalled()
    expect(screen.getByText(/Rejected/)).toBeDefined()
  })

  it('flags a proposal that restates an existing entity', async () => {
    harness.state.proposals = [
      makeProposal({ id: 'p-dup', duplicateOf: 'existing-id' }),
    ]
    await renderPanel(NOTE)
    expect(screen.getByText(/Looks like an existing entity/)).toBeDefined()
  })
})
