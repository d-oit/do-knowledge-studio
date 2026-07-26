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
  return { Eye: I, AlertTriangle: I }
})

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

vi.mock('@/components/studio/ui/shared-primitives', () => ({
  Overlay: ({ children, open, onClose: _onClose, ...rest }: { children?: ReactNode; open?: boolean; onClose?: () => void; [key: string]: unknown }) => (
    open ? <div data-testid="overlay" {...rest}>{children}</div> : null
  ),
}))

import { ImportPreviewDialog } from './import-preview-dialog'
import type { ImportPreview } from './export-helpers'

const basePreview: ImportPreview = {
  entities: [], claims: [], entityCount: 5, claimCount: 12, version: 1, duplicateIds: [],
}

const previewWithDuplicates: ImportPreview = {
  ...basePreview,
  duplicateIds: ['ent-1', 'ent-2'],
}

describe('ImportPreviewDialog', () => {
  const mockSetImportPreview = vi.fn()
  const mockHandleConfirmImport = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when importPreview is null', () => {
    const { container } = render(
      <ImportPreviewDialog importPreview={null} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders entity count', () => {
    render(
      <ImportPreviewDialog importPreview={basePreview} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    expect(screen.getByText('5')).toBeDefined()
  })

  it('renders claim count', () => {
    render(
      <ImportPreviewDialog importPreview={basePreview} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    expect(screen.getByText('12')).toBeDefined()
  })

  it('renders Import preview heading', () => {
    render(
      <ImportPreviewDialog importPreview={basePreview} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    expect(screen.getByText('Import preview')).toBeDefined()
  })

  it('does not show duplicate warning when no duplicates', () => {
    render(
      <ImportPreviewDialog importPreview={basePreview} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    expect(screen.queryByText(/existing.*will be replaced/)).toBeNull()
  })

  it('shows duplicate warning when duplicateIds present', () => {
    render(
      <ImportPreviewDialog importPreview={previewWithDuplicates} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    expect(screen.getByText(/2 existing entities will be replaced/)).toBeDefined()
  })

  it('shows singular entity when one duplicate', () => {
    const singleDuplicate: ImportPreview = { ...basePreview, duplicateIds: ['ent-1'] }
    render(
      <ImportPreviewDialog importPreview={singleDuplicate} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    expect(screen.getByText(/1 existing entity will be replaced/)).toBeDefined()
  })

  it('Cancel button calls setImportPreview(null)', () => {
    render(
      <ImportPreviewDialog importPreview={basePreview} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockSetImportPreview).toHaveBeenCalledWith(null)
  })

  it('Confirm button calls handleConfirmImport', () => {
    render(
      <ImportPreviewDialog importPreview={basePreview} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    fireEvent.click(screen.getByText('Confirm import'))
    expect(mockHandleConfirmImport).toHaveBeenCalled()
  })

  it('renders overlay with correct aria-label', () => {
    render(
      <ImportPreviewDialog importPreview={basePreview} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    expect(screen.getByLabelText('Confirm import')).toBeDefined()
  })

  it('shows snapshot info text', () => {
    render(
      <ImportPreviewDialog importPreview={basePreview} setImportPreview={mockSetImportPreview} handleConfirmImport={mockHandleConfirmImport} />,
    )
    expect(screen.getByText(/snapshot is taken/)).toBeDefined()
  })
})
