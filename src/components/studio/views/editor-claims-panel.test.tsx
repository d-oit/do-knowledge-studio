import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Claim } from '@/lib/studio/types'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

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
})
