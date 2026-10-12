import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { AlertTriangle: Icon, Trash2: Icon }
})

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

import { ConfirmDialog } from './confirm-dialog'

const makeProps = () => ({
  open: true,
  ariaLabel: 'Confirm delete',
  title: 'Delete entity?',
  subtitle: 'This cannot be undone.',
  body: '"Test Entity" will be permanently deleted.',
  cancelLabel: 'Cancel',
  confirmLabel: 'Delete',
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
})

describe('ConfirmDialog', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...makeProps()} open={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the dialog with its accessible name and copy', () => {
    render(<ConfirmDialog {...makeProps()} />)
    const dialog = screen.getByRole('dialog', { name: 'Confirm delete' })
    expect(dialog).toBeDefined()
    expect(screen.getByText('Delete entity?')).toBeDefined()
    expect(screen.getByText('This cannot be undone.')).toBeDefined()
    expect(screen.getByText('"Test Entity" will be permanently deleted.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined()
  })

  it('moves initial focus to cancel so the destructive action needs a deliberate step', () => {
    render(<ConfirmDialog {...makeProps()} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })

  it('runs the action on confirm', () => {
    const props = makeProps()
    render(<ConfirmDialog {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('dismisses without acting on cancel', () => {
    const props = makeProps()
    render(<ConfirmDialog {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).not.toHaveBeenCalled()
  })

  it('dismisses on Escape without acting', () => {
    const props = makeProps()
    render(<ConfirmDialog {...props} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' })
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).not.toHaveBeenCalled()
  })

  it('renders the optional icon only when provided', () => {
    const { unmount } = render(<ConfirmDialog {...makeProps()} />)
    expect(screen.queryByTestId('icon')).toBeNull()
    unmount()

    render(<ConfirmDialog {...makeProps()} icon={AlertTriangle} />)
    expect(screen.getByTestId('icon')).toBeDefined()
  })
})
