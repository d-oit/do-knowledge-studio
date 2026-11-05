import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ChangeEvent, RefObject } from 'react'
import type { ImportOutcome } from '@/lib/studio/store-types'
import type { Entity } from '@/lib/studio/types'
import type { ImportPreview } from './export-types'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('./export-types', () => ({
  todayStamp: vi.fn(() => '2026-07-26'),
  downloadFile: vi.fn(),
  downloadBlob: vi.fn(),
}))

vi.mock('./export-helpers', () => ({
  buildJsonExport: vi.fn(),
  buildMarkdownExport: vi.fn(),
  buildHtmlExport: vi.fn(),
  parseImportFile: vi.fn(),
}))

vi.mock('@/lib/okf/import', () => ({ parseOkfBundle: vi.fn() }))

/** Feeds archive entries through the streaming Unzip interface the reader uses. */
type OnData = (error: Error | null, data: Uint8Array, final: boolean) => void
interface FakeEntry {
  name: string
  ondata: OnData | null
  start: () => void
}
let archiveFiles: Record<string, Uint8Array> = {}
vi.mock('fflate', () => ({
  UnzipInflate: class {},
  strFromU8: (data: Uint8Array) => new TextDecoder().decode(data),
  Unzip: class {
    onfile: ((entry: FakeEntry) => void) | null = null
    register(): void {}
    push(): void {
      for (const [name, bytes] of Object.entries(archiveFiles)) {
        const entry: FakeEntry = {
          name,
          ondata: null,
          start: () => {
            entry.ondata?.(null, bytes, true)
          },
        }
        this.onfile?.(entry)
      }
    }
  },
}))

import { toast } from 'sonner'
import { parseOkfBundle } from '@/lib/okf/import'
import { useExportHandlers } from './use-export-handlers'

const importedEntities: Entity[] = [
  {
    id: 'new-1',
    name: 'New',
    type: 'note',
    description: '',
    content: '',
    tags: [],
    createdAt: '',
    updatedAt: '',
    links: [],
  },
]

const okfArchive = {
  'okf-bundle/index.md': new TextEncoder().encode('okf_version: "0.2"\n'),
  'okf-bundle/concepts/ok.md': new TextEncoder().encode('# OK'),
}

const vaultArchive = {
  'notes/solo.md': new TextEncoder().encode('Lone note linking [[Ghost]].\n'),
}

const fileInputRef: RefObject<HTMLInputElement | null> = { current: null }

const makeZipChangeEvent = (): ChangeEvent<HTMLInputElement> => {
  const input = document.createElement('input')
  Object.defineProperty(input, 'files', {
    value: [new File([new Uint8Array([1])], 'import.zip', { type: 'application/zip' })],
  })
  return { target: input } as ChangeEvent<HTMLInputElement>
}

const renderUseExportHandlers = (setImportPreview: (preview: ImportPreview | null) => void) => {
  const importWithRollback = vi.fn((): ImportOutcome => ({ success: true, backupPersisted: true }))
  return renderHook(() => useExportHandlers({
    entities: [],
    claims: [],
    importWithRollback,
    resetStore: vi.fn(),
    importPreview: null,
    setImportPreview,
    fileInputRef,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  archiveFiles = { ...okfArchive }
  vi.mocked(parseOkfBundle).mockReturnValue({
    entities: importedEntities,
    claims: [],
    errors: [],
  })
})

describe('OKF ZIP import handlers', () => {
  it('stages valid entries and reports partial parser errors', async () => {
    const setImportPreview = vi.fn()
    vi.mocked(parseOkfBundle).mockReturnValue({
      entities: importedEntities,
      claims: [],
      errors: ['broken.md: invalid YAML frontmatter'],
    })

    const { result } = renderUseExportHandlers(setImportPreview)
    await act(async () => { await result.current.handleFileChange(makeZipChangeEvent()) })

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith('Partial import', expect.anything())
      expect(setImportPreview).toHaveBeenCalledWith(expect.objectContaining({
        entities: importedEntities,
        duplicateIds: [],
      }))
    })
  })

  it('truncates long partial-import diagnostics at the toast budget', async () => {
    const setImportPreview = vi.fn()
    const longErrors = Array.from(
      { length: 40 },
      (_, index) => `file-${index}.md: invalid YAML frontmatter with a verbose diagnostic message that keeps going on`,
    )
    vi.mocked(parseOkfBundle).mockReturnValue({
      entities: importedEntities,
      claims: [],
      errors: longErrors,
    })

    const { result } = renderUseExportHandlers(setImportPreview)
    await act(async () => { await result.current.handleFileChange(makeZipChangeEvent()) })

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        'Partial import',
        expect.objectContaining({ description: expect.stringMatching(/…$/u) }),
      )
      const description = String(vi.mocked(toast.warning).mock.calls[0][1]?.description ?? '')
      expect(description.length).toBeLessThanOrEqual(320)
    })
  })

  it('imports a non-OKF zip as a vault with stubs in the preview', async () => {
    archiveFiles = { ...vaultArchive }
    const setImportPreview = vi.fn()
    const { result } = renderUseExportHandlers(setImportPreview)
    await act(async () => { await result.current.handleFileChange(makeZipChangeEvent()) })

    await waitFor(() => {
      expect(setImportPreview).toHaveBeenCalledWith(expect.objectContaining({
        entityCount: 2,
        stubNames: ['Ghost'],
      }))
    })
  })
})
