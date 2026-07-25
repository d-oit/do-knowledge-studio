import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

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

const mockSetView = vi.fn()
const mockImportWithRollback = vi.fn()
const mockResetStore = vi.fn()
const mockHandleExport = vi.fn()
const mockHandleImportClick = vi.fn()
const mockHandleFileChange = vi.fn()
const mockHandleConfirmImport = vi.fn()
const mockHandleReset = vi.fn()

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
    handleConfirmImport: mockHandleConfirmImport,
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

let currentEntities = mockEntities
let currentClaims = mockClaims

import { ExportView } from './export-view'

describe('ExportView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentEntities = mockEntities
    currentClaims = mockClaims
  })

  it('renders format grid section', () => {
    render(<ExportView />)
    expect(screen.getByText('Export knowledge')).toBeDefined()
  })

  it('renders import dropzone section', () => {
    render(<ExportView />)
    expect(screen.getByText('Import knowledge')).toBeDefined()
  })

  it('renders backup tips section', () => {
    render(<ExportView />)
    expect(screen.getByText('Backup tips')).toBeDefined()
  })

  it('shows entity and claim count', () => {
    render(<ExportView />)
    expect(screen.getByText(/1 entities · 1 claims/)).toBeDefined()
  })

  it('handles empty state with zero entities', () => {
    currentEntities = []
    currentClaims = []
    render(<ExportView />)
    expect(screen.getByText(/0 entities · 0 claims/)).toBeDefined()
    expect(screen.getByText(/No entities to export yet/)).toBeDefined()
  })

  it('renders reset to demo data button', () => {
    render(<ExportView />)
    expect(screen.getByText('Reset to demo data')).toBeDefined()
  })

  it('renders saved to this browser label', () => {
    render(<ExportView />)
    const matches = screen.getAllByText(/saved to this browser/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})
