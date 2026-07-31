import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <section {...(props as React.HTMLAttributes<HTMLElement>)}>{children}</section>
    ),
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
  return {
    RotateCcw: I,
    FileText: I,
    Download: I,
    Shield: I,
    ArrowRight: I,
    Upload: I,
    Sparkles: I,
    Check: I,
    Eye: I,
    EyeOff: I,
    Lock: I,
    FileLock: I,
    FileJson: I,
    FileCode: I,
    FileArchive: I,
    AlertTriangle: I,
  }
})

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/export/encrypt', () => ({
  encryptData: vi.fn(),
  buildEncryptedReaderHtml: vi.fn(),
}))

vi.mock('./export-format-grid', () => ({
  ExportFormatGrid: ({ setView }: { setView?: (v: string) => void }) => (
    <div data-testid="format-grid" onClick={() => setView?.('export')}>Export knowledge</div>
  ),
}))

vi.mock('./import-dropzone', () => ({
  ImportDropzone: ({ handleImportClick, handleFileChange }: { handleImportClick?: () => void; handleFileChange?: () => void }) => (
    <div data-testid="dropzone" onClick={() => { handleImportClick?.(); handleFileChange?.() }}>Import knowledge</div>
  ),
}))

vi.mock('./backup-tips', () => ({
  BackupTips: () => <div data-testid="backup-tips">Backup tips</div>,
}))

vi.mock('./encrypt-export-dialog', () => ({
  EncryptExportDialog: ({ showPassword, setShowPassword }: { showPassword?: boolean; setShowPassword?: (v: boolean) => void }) => (
    <div data-testid="encrypt-dialog" data-show={String(showPassword)} onClick={() => setShowPassword?.(false)}>
      Encrypt export
    </div>
  ),
}))

vi.mock('./reset-confirm-dialog', () => ({
  ResetConfirmDialog: ({ showResetConfirm, setShowResetConfirm, handleReset }: { showResetConfirm?: boolean; setShowResetConfirm?: (v: boolean) => void; handleReset?: () => void }) => (
    <div data-testid="reset-dialog" data-show={String(showResetConfirm)} onClick={() => { setShowResetConfirm?.(false); handleReset?.() }}>
      Confirm reset
    </div>
  ),
}))

vi.mock('./import-preview-dialog', () => ({
  ImportPreviewDialog: ({ importPreview, setImportPreview }: { importPreview?: unknown; setImportPreview?: (v: unknown) => void }) => (
    <div data-testid="preview-dialog" data-show={String(Boolean(importPreview))} onClick={() => setImportPreview?.(null)}>
      Import preview
    </div>
  ),
}))

const mockSetView = vi.fn()
const mockImportWithRollback = vi.fn()
const mockResetStore = vi.fn()
const mockHandleImportClick = vi.fn()
const mockHandleFileChange = vi.fn()

const mockEntities = [
  {
    id: 'ent-1',
    name: 'Test Entity',
    type: 'note' as const,
    description: 'desc',
    content: 'content',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
]

const mockClaims = [
  {
    id: 'claim-1',
    entityId: 'ent-1',
    statement: 'Test claim',
    confidence: 0.8,
    verification: 'unverified' as const,
  },
]

let currentEntities = mockEntities
let currentClaims = mockClaims
const mockHandleExport = vi.fn()
const mockHandleReset = vi.fn()

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: currentEntities,
      claims: currentClaims,
      importWithRollback: mockImportWithRollback,
      resetStore: mockResetStore,
      setView: mockSetView,
    }),
}))

vi.mock('./use-export-handlers', () => ({
  useExportHandlers: () => ({
    handleExport: mockHandleExport,
    handleImportClick: mockHandleImportClick,
    handleFileChange: mockHandleFileChange,
    handleConfirmImport: vi.fn(),
    handleReset: mockHandleReset,
    showPassword: false,
    setShowPassword: vi.fn(),
    password: '',
    setPassword: vi.fn(),
    confirm: '',
    setConfirm: vi.fn(),
    showPass: false,
    setShowPass: vi.fn(),
  }),
}))

import { ExportView } from './export-view'

describe('ExportView branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    currentClaims = mockClaims
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows entity and claim counts', () => {
    render(<ExportView />)
    expect(screen.getByText(/1 entities · 1 claims/)).toBeDefined()
  })

  it('shows zero counts for empty store', () => {
    currentEntities = []
    currentClaims = []
    render(<ExportView />)
    expect(screen.getByText(/0 entities · 0 claims/)).toBeDefined()
  })

  it('opens reset confirm dialog when reset button is clicked', () => {
    render(<ExportView />)
    fireEvent.click(screen.getByText('Reset to demo data'))
    expect(screen.getByTestId('reset-dialog')).toHaveAttribute('data-show', 'true')
  })

  it('closes reset confirm dialog on Escape', async () => {
    render(<ExportView />)
    fireEvent.click(screen.getByText('Reset to demo data'))
    expect(screen.getByTestId('reset-dialog')).toHaveAttribute('data-show', 'true')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.getByTestId('reset-dialog')).toHaveAttribute('data-show', 'false')
    })
  })

  it('calls handleReset when reset dialog confirms', () => {
    render(<ExportView />)
    fireEvent.click(screen.getByText('Reset to demo data'))
    fireEvent.click(screen.getByTestId('reset-dialog'))
    expect(mockHandleReset).toHaveBeenCalled()
  })

  it('renders all sections', () => {
    render(<ExportView />)
    expect(screen.getByTestId('format-grid')).toBeDefined()
    expect(screen.getByTestId('dropzone')).toBeDefined()
    expect(screen.getByTestId('backup-tips')).toBeDefined()
  })

  it('passes setView to format grid', () => {
    render(<ExportView />)
    fireEvent.click(screen.getByTestId('format-grid'))
    expect(mockSetView).toHaveBeenCalledWith('export')
  })

  it('handles import dropzone click', () => {
    render(<ExportView />)
    fireEvent.click(screen.getByTestId('dropzone'))
    expect(mockHandleImportClick).toHaveBeenCalled()
    expect(mockHandleFileChange).toHaveBeenCalled()
  })

  it('renders import preview dialog closed by default', () => {
    render(<ExportView />)
    expect(screen.getByTestId('preview-dialog')).toHaveAttribute('data-show', 'false')
  })
})
