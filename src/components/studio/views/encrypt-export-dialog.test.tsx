import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('lucide-react', () => {
  const I = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { FileLock: I }
})

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

vi.mock('@/components/studio/ui/shared-primitives', () => ({
  Overlay: ({ children, open, onClose: _onClose, ...rest }: { children?: ReactNode; open?: boolean; onClose?: () => void; [key: string]: unknown }) => (
    open ? <div data-testid="overlay" {...rest}>{children}</div> : null
  ),
}))

import { EncryptExportDialog } from './encrypt-export-dialog'

describe('EncryptExportDialog', () => {
  const defaultProps = {
    showPassword: true,
    setShowPassword: vi.fn(),
    password: '',
    setPassword: vi.fn(),
    confirm: '',
    setConfirm: vi.fn(),
    showPass: false,
    setShowPass: vi.fn(),
    handleExport: vi.fn(() => Promise.resolve()),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when showPassword is false', () => {
    const { container } = render(<EncryptExportDialog {...defaultProps} showPassword={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders Encrypt export heading', () => {
    render(<EncryptExportDialog {...defaultProps} />)
    expect(screen.getByText('Encrypt export')).toBeDefined()
  })

  it('renders password input', () => {
    render(<EncryptExportDialog {...defaultProps} />)
    expect(document.getElementById('encrypt-password')).not.toBeNull()
  })

  it('renders confirm password input', () => {
    render(<EncryptExportDialog {...defaultProps} />)
    expect(document.getElementById('encrypt-confirm-password')).not.toBeNull()
  })

  it('shows password mismatch error when passwords differ', () => {
    render(<EncryptExportDialog {...defaultProps} password="abc" confirm="xyz" />)
    expect(screen.getByText('Passwords do not match.')).toBeDefined()
  })

  it('does not show mismatch error when passwords match', () => {
    render(<EncryptExportDialog {...defaultProps} password="abc" confirm="abc" />)
    expect(screen.queryByText('Passwords do not match.')).toBeNull()
  })

  it('Cancel calls setShowPassword(false)', () => {
    render(<EncryptExportDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(defaultProps.setShowPassword).toHaveBeenCalledWith(false)
  })

  it('Encrypt & export button calls handleExport encrypted', () => {
    render(<EncryptExportDialog {...defaultProps} password="abc" confirm="abc" />)
    fireEvent.click(screen.getByText('Encrypt & export'))
    expect(defaultProps.handleExport).toHaveBeenCalledWith('encrypted')
  })

  it('Encrypt & export button is disabled when passwords empty', () => {
    render(<EncryptExportDialog {...defaultProps} />)
    const btn = screen.getByText('Encrypt & export')
    expect(btn).toHaveProperty('disabled', true)
  })

  it('Encrypt & export button is disabled when passwords mismatch', () => {
    render(<EncryptExportDialog {...defaultProps} password="a" confirm="b" />)
    const btn = screen.getByText('Encrypt & export')
    expect(btn).toHaveProperty('disabled', true)
  })

  it('Encrypt & export button is enabled when passwords match', () => {
    render(<EncryptExportDialog {...defaultProps} password="abc" confirm="abc" />)
    const btn = screen.getByText('Encrypt & export')
    expect(btn).toHaveProperty('disabled', false)
  })

  it('Show/Hide toggle calls setShowPass', () => {
    render(<EncryptExportDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Show'))
    expect(defaultProps.setShowPass).toHaveBeenCalledWith(true)
  })

  it('Hide button shown when showPass is true', () => {
    render(<EncryptExportDialog {...defaultProps} showPass={true} />)
    expect(screen.getByText('Hide')).toBeDefined()
  })

  it('renders overlay with correct aria-label', () => {
    render(<EncryptExportDialog {...defaultProps} />)
    expect(screen.getByLabelText('Encrypt export')).toBeDefined()
  })
})
