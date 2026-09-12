import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Claim } from '@/lib/studio/types'

const sonnerMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: sonnerMocks }))

const storeState = vi.hoisted(() => ({
  entities: [] as Array<{ id: string; content: string }>,
}))

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: { entities: typeof storeState.entities }) => unknown) =>
    selector({ entities: storeState.entities }),
}))

// Keep the real parser; make the visibility gate content-presence based so the
// defensive "nothing to extract" toast branch stays reachable in tests.
vi.mock('@/lib/studio/claim-parser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/studio/claim-parser')>()
  return {
    ...actual,
    hasExtractableClaims: (text: string) => text.trim().length > 0,
  }
})

vi.mock('lucide-react', () => {
  const I = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    Plus: I,
    ExternalLink: I,
    ShieldCheck: I,
    CheckCircle2: I,
    AlertTriangle: I,
    Circle: I,
    Save: I,
    Pencil: I,
    Trash2: I,
    Wand2: I,
    X: I,
  }
})

const mockAddClaim = vi.fn()
const mockUpdateClaim = vi.fn()
const mockDeleteClaim = vi.fn()

const baseClaim: Claim = {
  id: 'claim-1',
  entityId: 'ent-1',
  statement: 'Test claim statement',
  confidence: 0.8,
  verification: 'verified',
  source: 'https://example.com',
}

import { VerificationBadge, ClaimsPanel } from './editor-claims-panel'

describe('VerificationBadge', () => {
  it('renders Verified for verified status', () => {
    render(<VerificationBadge status="verified" />)
    expect(screen.getByText('Verified')).toBeDefined()
  })

  it('renders Disputed for disputed status', () => {
    render(<VerificationBadge status="disputed" />)
    expect(screen.getByText('Disputed')).toBeDefined()
  })

  it('renders Unverified for unverified status', () => {
    render(<VerificationBadge status="unverified" />)
    expect(screen.getByText('Unverified')).toBeDefined()
  })
})

describe('ClaimsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.entities = []
  })

  it('renders claims heading', () => {
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.getByText('Claims')).toBeDefined()
  })

  it('shows claim count badge', () => {
    render(
      <ClaimsPanel
        claims={[baseClaim]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.getByText('1 claim')).toBeDefined()
  })

  it('shows plural claim count', () => {
    const twoClaims = [
      baseClaim,
      { ...baseClaim, id: 'claim-2', statement: 'Second claim' },
    ]
    render(
      <ClaimsPanel
        claims={twoClaims}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.getByText('2 claims')).toBeDefined()
  })

  it('renders claim statement text', () => {
    render(
      <ClaimsPanel
        claims={[baseClaim]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.getByText(/Test claim statement/)).toBeDefined()
  })

  it('shows empty state when no claims', () => {
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.getByText(/No claims recorded/)).toBeDefined()
  })

  it('renders Add claim button', () => {
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.getByRole('button', { name: /Add claim/ })).toBeDefined()
  })

  it('shows form when Add claim is clicked', () => {
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Add claim/ }))
    expect(screen.getByLabelText('Statement')).toBeDefined()
    expect(screen.getByLabelText('Verification')).toBeDefined()
    expect(screen.getByLabelText(/Confidence/)).toBeDefined()
    expect(screen.getByLabelText('Source (optional)')).toBeDefined()
  })

  it('calls addClaim with correct data on save', () => {
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Add claim/ }))
    fireEvent.change(screen.getByLabelText('Statement'), {
      target: { value: 'New claim' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save claim/ }))
    expect(mockAddClaim).toHaveBeenCalledWith({
      entityId: 'ent-1',
      statement: 'New claim',
      verification: 'unverified',
      confidence: 0.5,
      source: undefined,
    })
  })

  it('disables Save button when statement is empty', () => {
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Add claim/ }))
    const saveBtn = screen.getByRole('button', { name: /Save claim/ })
    expect(saveBtn).toBeDisabled()
  })

  it('enables Save button when statement has content', () => {
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Add claim/ }))
    fireEvent.change(screen.getByLabelText('Statement'), {
      target: { value: 'A valid claim' },
    })
    expect(screen.getByRole('button', { name: /Save claim/ })).toBeEnabled()
  })

  it('calls deleteClaim when delete button is clicked', () => {
    render(
      <ClaimsPanel
        claims={[baseClaim]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Delete claim/ }))
    expect(mockDeleteClaim).toHaveBeenCalledWith('claim-1')
  })

  it('cancel button resets form', () => {
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Add claim/ }))
    fireEvent.change(screen.getByLabelText('Statement'), {
      target: { value: 'Some text' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Statement')).toBeNull()
    expect(screen.getByRole('button', { name: /Add claim/ })).toBeDefined()
  })

  it('shows source link when claim has source', () => {
    render(
      <ClaimsPanel
        claims={[baseClaim]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.getByText('https://example.com')).toBeDefined()
  })

  it('shows evidence when claim has evidence', () => {
    const claimWithEvidence = { ...baseClaim, evidence: 'Supporting evidence text' }
    render(
      <ClaimsPanel
        claims={[claimWithEvidence]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.getByText('Supporting evidence text')).toBeDefined()
  })

  it('pre-fills form when Edit is clicked on existing claim', () => {
    render(
      <ClaimsPanel
        claims={[baseClaim]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Edit claim/ }))

    const statementInput = screen.getByLabelText(/Edit statement/)
    expect(statementInput).toHaveValue('Test claim statement')

    const verificationSelect = screen.getByLabelText('Verification')
    expect(verificationSelect).toHaveValue('verified')

    const sourceInput = screen.getByLabelText('Source (optional)')
    expect(sourceInput).toHaveValue('https://example.com')

    expect(screen.getByRole('button', { name: /Update claim/ })).toBeDefined()
  })

  it('calls updateClaim when saving edited claim', () => {
    render(
      <ClaimsPanel
        claims={[baseClaim]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Edit claim/ }))
    fireEvent.change(screen.getByLabelText(/Edit statement/), {
      target: { value: 'Updated statement' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Update claim/ }))

    expect(mockUpdateClaim).toHaveBeenCalledWith('claim-1', {
      statement: 'Updated statement',
      verification: 'verified',
      confidence: 0.8,
      source: 'https://example.com',
    })
  })

  it('renders Extract claims button when the note has content', () => {
    storeState.entities = [{ id: 'ent-1', content: 'Assertion: Bees dance to communicate (Source: Nature documentary)' }]
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.getByRole('button', { name: /Extract claims/ })).toBeDefined()
  })

  it('hides Extract claims button when the note has no content', () => {
    storeState.entities = [{ id: 'ent-1', content: '' }]
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    expect(screen.queryByRole('button', { name: /Extract claims/ })).toBeNull()
  })

  it('opens a preview dialog listing parsed assertions with sources', () => {
    storeState.entities = [{ id: 'ent-1', content: 'Assertion: Bees dance to communicate (Source: Nature documentary)' }]
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Extract claims/ }))
    expect(screen.getByText(/Bees dance to communicate/)).toBeDefined()
    expect(screen.getByText('Nature documentary')).toBeDefined()
    expect(screen.getByRole('button', { name: /Add 1 claim/ })).toBeDefined()
  })

  it('adds extracted claims with default confidence on confirm', () => {
    storeState.entities = [{ id: 'ent-1', content: 'Assertion: Bees dance to communicate (Source: Nature documentary)' }]
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Extract claims/ }))
    fireEvent.click(screen.getByRole('button', { name: /Add 1 claim/ }))
    expect(mockAddClaim).toHaveBeenCalledWith({
      entityId: 'ent-1',
      statement: 'Bees dance to communicate',
      source: 'Nature documentary',
      confidence: 0.5,
      verification: 'unverified',
    })
    expect(sonnerMocks.success).toHaveBeenCalledWith('Added 1 claim')
  })

  it('cancel closes the dialog without adding claims', () => {
    storeState.entities = [{ id: 'ent-1', content: 'Assertion: Bees dance to communicate (Source: Nature documentary)' }]
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Extract claims/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockAddClaim).not.toHaveBeenCalled()
    expect(screen.queryByText(/Bees dance to communicate/)).toBeNull()
    expect(sonnerMocks.success).not.toHaveBeenCalled()
  })

  it('skips claims that already exist for the entity', () => {
    storeState.entities = [
      { id: 'ent-1', content: 'Assertion: Existing claim (Source: same)\nAssertion: Brand new claim' },
    ]
    const existingClaim = { ...baseClaim, id: 'claim-9', statement: 'Existing claim', source: 'same' }
    render(
      <ClaimsPanel
        claims={[existingClaim]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Extract claims/ }))
    fireEvent.click(screen.getByRole('button', { name: /Add 2 claims/ }))
    expect(mockAddClaim).toHaveBeenCalledTimes(1)
    expect(mockAddClaim).toHaveBeenCalledWith({
      entityId: 'ent-1',
      statement: 'Brand new claim',
      source: undefined,
      confidence: 0.5,
      verification: 'unverified',
    })
    expect(sonnerMocks.success).toHaveBeenCalledWith('Added 1 claim')
    expect(sonnerMocks.info).toHaveBeenCalledWith('Skipped 1 duplicate')
  })

  it('shows an info toast when nothing can be extracted', () => {
    storeState.entities = [{ id: 'ent-1', content: 'No assertions here' }]
    render(
      <ClaimsPanel
        claims={[]}
        editingEntityId="ent-1"
        addClaim={mockAddClaim}
        updateClaim={mockUpdateClaim}
        deleteClaim={mockDeleteClaim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Extract claims/ }))
    expect(sonnerMocks.info).toHaveBeenCalledWith('No extractable assertions found in this note.')
    expect(screen.queryByRole('button', { name: /Add 1 claim/ })).toBeNull()
    expect(mockAddClaim).not.toHaveBeenCalled()
  })
})