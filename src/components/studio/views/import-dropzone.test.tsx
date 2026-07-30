import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <section {...(props as React.HTMLAttributes<HTMLElement>)}>{children}</section>
    ),
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { Upload: Icon }
})

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

import { ImportDropzone } from './import-dropzone'

const defaultProps = {
  handleImportClick: vi.fn(),
  handleFileChange: vi.fn(),
  fileInputRef: { current: null } as React.RefObject<HTMLInputElement | null>,
}

describe('ImportDropzone', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the Import knowledge heading', () => {
    render(<ImportDropzone {...defaultProps} />)
    expect(screen.getByText('Import knowledge')).toBeDefined()
  })

  it('renders the description text', () => {
    render(<ImportDropzone {...defaultProps} />)
    expect(screen.getByText(/Replace your current library/)).toBeDefined()
  })

  it('renders Choose a JSON file heading', () => {
    render(<ImportDropzone {...defaultProps} />)
    expect(screen.getByText('Choose a JSON file')).toBeDefined()
  })

  it('renders the format description', () => {
    render(<ImportDropzone {...defaultProps} />)
    expect(screen.getByText(/entities.*claims/)).toBeDefined()
  })

  it('renders the Choose file button', () => {
    render(<ImportDropzone {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeDefined()
  })

  it('calls handleImportClick on button click', () => {
    const handleImportClick = vi.fn()
    render(<ImportDropzone {...defaultProps} handleImportClick={handleImportClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose file' }))
    expect(handleImportClick).toHaveBeenCalled()
  })

  it('renders a hidden file input', () => {
    const { container } = render(<ImportDropzone {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toBeDefined()
    expect(fileInput).toHaveAttribute('accept', '.json,application/json')
  })

  it('file input is hidden and not focusable', () => {
    const { container } = render(<ImportDropzone {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('aria-hidden', 'true')
    expect(fileInput).toHaveAttribute('tabindex', '-1')
  })

  it('renders the upload icon', () => {
    render(<ImportDropzone {...defaultProps} />)
    expect(screen.getByTestId('icon')).toBeDefined()
  })

  it('calls handleFileChange when file is selected', () => {
    const handleFileChange = vi.fn()
    const { container } = render(<ImportDropzone {...defaultProps} handleFileChange={handleFileChange} />)
    const fileInput = container.querySelector('input[type="file"]')!
    fireEvent.change(fileInput)
    expect(handleFileChange).toHaveBeenCalled()
  })
})
