/**
 * Export busy-state test (Plan 20: "Export panel shows progress/error/success
 * states").
 *
 * The busy flag lives in `useExportHandlers` and is rendered by
 * `ExportFormatGrid`, so this renders the two together exactly as the export
 * view wires them and holds the PDF build on a deferred promise: the assertion
 * is that the DOM disables the triggering control, marks the region busy, shows
 * the status line, and comes back to idle when the promise settles — on success
 * *and* on failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRef } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

// `downloadBlob` runs after the deferred build resolves; jsdom has no
// `URL.createObjectURL`, so the download itself is stubbed out.
vi.mock('./export-types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./export-types')>()
  return { ...actual, downloadBlob: vi.fn(), downloadFile: vi.fn() }
})

/** Settles the pending PDF build. */
let resolvePdf: () => void = () => undefined
/** Fails the pending PDF build. */
let rejectPdf: (reason?: unknown) => void = () => undefined

vi.mock('./export-documents', () => ({
  buildPdfExport: () =>
    new Promise<Blob>((resolve, reject) => {
      resolvePdf = () => { resolve(new Blob(['pdf'])) }
      rejectPdf = (reason?: unknown) => { reject(reason) }
    }),
}))

import { useExportHandlers } from './use-export-handlers'
import { ExportFormatGrid } from './export-format-grid'

const mockEntities = [
  {
    id: 'ent-1',
    name: 'Test',
    type: 'note' as const,
    description: '',
    content: '',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    links: [],
  },
]

const mockClaims = [
  { id: 'claim-1', entityId: 'ent-1', statement: 's', confidence: 0.5, verification: 'unverified' as const },
]

/** Real hook + real grid, wired the way the export view wires them. */
const ExportBusyHarness = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const handlers = useExportHandlers({
    entities: mockEntities,
    claims: mockClaims,
    importWithRollback: vi.fn(),
    resetStore: vi.fn(),
    importPreview: null,
    setImportPreview: vi.fn(),
    fileInputRef,
  })

  return (
    <ExportFormatGrid
      entities={mockEntities}
      setView={vi.fn()}
      setShowPassword={vi.fn()}
      handleExport={handlers.handleExport}
      exportingFormat={handlers.exportingFormat}
    />
  )
}

/** The region the grid marks `aria-busy`. */
const busyRegion = (): Element | null =>
  screen.getByText('Export knowledge').closest('section')

/** The card that starts the PDF export. */
const pdfCard = (): HTMLElement | null =>
  screen.getByText('PDF document').closest('button')

describe('export busy state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables the triggering control while pending and re-enables it after', async () => {
    render(<ExportBusyHarness />)
    expect(pdfCard()).toBeEnabled()
    expect(busyRegion()).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByRole('status')).toBeNull()

    fireEvent.click(pdfCard()!)

    await waitFor(() => {
      expect(pdfCard()).toBeDisabled()
    })
    expect(busyRegion()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status').textContent).toContain('Exporting PDF document…')

    resolvePdf()

    await waitFor(() => {
      expect(pdfCard()).toBeEnabled()
    })
    expect(busyRegion()).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('clears the busy state when the export fails', async () => {
    render(<ExportBusyHarness />)
    fireEvent.click(pdfCard()!)

    await waitFor(() => {
      expect(pdfCard()).toBeDisabled()
    })

    rejectPdf(new Error('pdf build exploded'))

    await waitFor(() => {
      expect(pdfCard()).toBeEnabled()
    })
    expect(busyRegion()).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
