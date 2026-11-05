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

  it('renders Choose files or a folder heading', () => {
    render(<ImportDropzone {...defaultProps} />)
    expect(screen.getByText('Choose files or a folder')).toBeDefined()
  })

  it('renders the format description', () => {
    render(<ImportDropzone {...defaultProps} />)
    expect(screen.getByText(/vault/)).toBeDefined()
  })

  it('renders file and folder picker buttons', () => {
    render(<ImportDropzone {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Choose folder' })).toBeDefined()
  })

  it('calls handleImportClick on button click', () => {
    const handleImportClick = vi.fn()
    render(<ImportDropzone {...defaultProps} handleImportClick={handleImportClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose files' }))
    expect(handleImportClick).toHaveBeenCalled()
  })

  it('renders hidden file and folder inputs', () => {
    const { container } = render(<ImportDropzone {...defaultProps} />)
    const inputs = container.querySelectorAll('input[type="file"]')
    expect(inputs).toHaveLength(2)
    expect(inputs[0]).toHaveAttribute('accept', '.json,application/json,.md,.markdown,text/markdown,.zip,application/zip')
    expect(inputs[1]).not.toHaveAttribute('accept')
    expect(inputs[1]).toHaveAttribute('webkitdirectory', '')
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
