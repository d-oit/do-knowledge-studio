import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { RotateCcw: Icon }
})

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/studio/ui/shared-primitives', () => ({
  Overlay: ({ children, open, onClose, 'aria-label': ariaLabel }: {
    children: ReactNode
    open: boolean
    onClose: () => void
    'aria-label'?: string
    initialFocusRef?: React.RefObject<HTMLElement | null>
  }) =>
    open ? (
      <div data-testid="overlay" role="dialog" aria-label={ariaLabel} onClick={onClose}>
        {children}
      </div>
    ) : null,
}))

import { ResetConfirmDialog } from './reset-confirm-dialog'

const defaultProps = {
  showResetConfirm: true,
  setShowResetConfirm: vi.fn(),
  handleReset: vi.fn(),
  resetCancelRef: { current: null } as React.RefObject<HTMLButtonElement | null>,
}

describe('ResetConfirmDialog', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders when showResetConfirm is true', () => {
    render(<ResetConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Reset to demo data?')).toBeDefined()
  })

  it('renders nothing when showResetConfirm is false', () => {
    render(<ResetConfirmDialog {...defaultProps} showResetConfirm={false} />)
    expect(screen.queryByText('Reset to demo data?')).toBeNull()
  })

  it('shows the warning message', () => {
    render(<ResetConfirmDialog {...defaultProps} />)
    expect(screen.getByText(/This will delete all your entities and claims/)).toBeDefined()
  })

  it('shows the cannot be undone message', () => {
    render(<ResetConfirmDialog {...defaultProps} />)
    expect(screen.getByText(/This action cannot be undone/)).toBeDefined()
  })

  it('renders Cancel button', () => {
    render(<ResetConfirmDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined()
  })

  it('renders Reset everything button', () => {
    render(<ResetConfirmDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Reset everything' })).toBeDefined()
  })

  it('calls setShowResetConfirm(false) on Cancel', () => {
    const setShowResetConfirm = vi.fn()
    render(<ResetConfirmDialog {...defaultProps} setShowResetConfirm={setShowResetConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(setShowResetConfirm).toHaveBeenCalledWith(false)
  })

  it('calls handleReset and closes on Reset everything', () => {
    const handleReset = vi.fn()
    const setShowResetConfirm = vi.fn()
    render(
      <ResetConfirmDialog
        {...defaultProps}
        handleReset={handleReset}
        setShowResetConfirm={setShowResetConfirm}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reset everything' }))
    expect(handleReset).toHaveBeenCalled()
    expect(setShowResetConfirm).toHaveBeenCalledWith(false)
  })

  it('calls setShowResetConfirm(false) on overlay click (outside dialog)', () => {
    const setShowResetConfirm = vi.fn()
    render(<ResetConfirmDialog {...defaultProps} setShowResetConfirm={setShowResetConfirm} />)
    fireEvent.click(screen.getByTestId('overlay'))
    expect(setShowResetConfirm).toHaveBeenCalledWith(false)
  })

  it('dialog stops propagation on inner click', () => {
    const setShowResetConfirm = vi.fn()
    render(<ResetConfirmDialog {...defaultProps} setShowResetConfirm={setShowResetConfirm} />)
    // The inner motion.div stops propagation — clicking the heading should not close
    fireEvent.click(screen.getByText('Reset to demo data?'))
    // setShowResetConfirm should NOT be called because stopPropagation on inner div
    expect(setShowResetConfirm).not.toHaveBeenCalled()
  })

  it('has accessible dialog role', () => {
    render(<ResetConfirmDialog {...defaultProps} />)
    expect(screen.getByRole('dialog', { name: 'Confirm reset' })).toBeDefined()
  })

  it('renders the RotateCcw icon', () => {
    render(<ResetConfirmDialog {...defaultProps} />)
    expect(screen.getByTestId('icon')).toBeDefined()
  })

  it('mentions exporting data first', () => {
    render(<ResetConfirmDialog {...defaultProps} />)
    expect(screen.getByText(/Export your data first/)).toBeDefined()
  })
})
