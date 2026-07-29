import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

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
    FileText: I, Download: I, Shield: I, ArrowRight: I,
    FileJson: I, FileCode: I, FileArchive: I, FileLock: I,
  }
})

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}))

vi.mock('./export-helpers', () => {
  const I = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    FORMATS: [
      { id: 'markdown', name: 'Markdown', description: 'Single .md file', icon: I, color: 'saffron', available: true },
      { id: 'json', name: 'JSON', description: 'Backup file', icon: I, color: 'sky', available: true },
      { id: 'html', name: 'Static HTML', description: 'Self-contained page', icon: I, color: 'sage', available: true },
      { id: 'pdf', name: 'PDF document', description: 'Print-ready', icon: I, color: 'clay', available: true },
      { id: 'docx', name: 'DOCX document', description: 'Word document', icon: I, color: 'saffron', available: true },
      { id: 'encrypted', name: 'Encrypted HTML', description: 'Password-protected', icon: I, color: 'clay', badge: 'Secure', available: true },
    ],
    COLOR_MAP: {
      saffron: 'bg-saffron-soft text-saffron-deep',
      sky: 'bg-sky-100 text-sky-600',
      sage: 'bg-emerald-100 text-emerald-600',
      clay: 'bg-rose-100 text-clay',
    },
  }
})

import { ExportFormatGrid } from './export-format-grid'

const mockEntities = [
  { id: 'ent-1', name: 'Test', type: 'note' as const, description: '', content: '', tags: [], createdAt: '', updatedAt: '', links: [] },
]

describe('ExportFormatGrid', () => {
  const mockSetView = vi.fn()
  const mockSetShowPassword = vi.fn()
  const mockHandleExport = vi.fn(async () => {})

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders export knowledge heading', () => {
    render(
      <ExportFormatGrid entities={mockEntities} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    expect(screen.getByText('Export knowledge')).toBeDefined()
  })

  it('shows empty state when entities is empty', () => {
    render(
      <ExportFormatGrid entities={[]} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    expect(screen.getByText(/No entities to export yet/)).toBeDefined()
  })

  it('shows format cards when entities are present', () => {
    render(
      <ExportFormatGrid entities={mockEntities} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    expect(screen.getByText('Markdown')).toBeDefined()
    expect(screen.getByText('JSON')).toBeDefined()
    expect(screen.getByText('Static HTML')).toBeDefined()
    expect(screen.getByText('PDF document')).toBeDefined()
    expect(screen.getByText('DOCX document')).toBeDefined()
    expect(screen.getByText('Encrypted HTML')).toBeDefined()
  })

  it('calls handleExport on format click', () => {
    render(
      <ExportFormatGrid entities={mockEntities} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    fireEvent.click(screen.getByText('JSON'))
    expect(mockHandleExport).toHaveBeenCalledWith('json')
  })

  it('calls handleExport for markdown format', () => {
    render(
      <ExportFormatGrid entities={mockEntities} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    fireEvent.click(screen.getByText('Markdown'))
    expect(mockHandleExport).toHaveBeenCalledWith('markdown')
  })

  it('calls handleExport for html format', () => {
    render(
      <ExportFormatGrid entities={mockEntities} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    fireEvent.click(screen.getByText('Static HTML'))
    expect(mockHandleExport).toHaveBeenCalledWith('html')
  })

  it('calls setShowPassword for encrypted format', () => {
    render(
      <ExportFormatGrid entities={mockEntities} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    fireEvent.click(screen.getByText('Encrypted HTML'))
    expect(mockSetShowPassword).toHaveBeenCalledWith(true)
    expect(mockHandleExport).not.toHaveBeenCalled()
  })

  it('Create entity button calls setView editor', () => {
    render(
      <ExportFormatGrid entities={[]} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    fireEvent.click(screen.getByText('Create entity'))
    expect(mockSetView).toHaveBeenCalledWith('editor')
  })

  it('shows Secure badge for encrypted format', () => {
    render(
      <ExportFormatGrid entities={mockEntities} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    expect(screen.getAllByText('Secure').length).toBeGreaterThanOrEqual(1)
  })

  it('renders format descriptions', () => {
    render(
      <ExportFormatGrid entities={mockEntities} setView={mockSetView} setShowPassword={mockSetShowPassword} handleExport={mockHandleExport} />,
    )
    expect(screen.getByText('Single .md file')).toBeDefined()
    expect(screen.getByText('Backup file')).toBeDefined()
    expect(screen.getByText('Password-protected')).toBeDefined()
  })
})
