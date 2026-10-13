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

vi.mock('fflate', () => ({
  unzipSync: vi.fn(),
  zipSync: vi.fn(),
  strToU8: vi.fn(),
  strFromU8: vi.fn((data: Uint8Array) => new TextDecoder().decode(data)),
}))

import { toast } from 'sonner'
import { parseOkfBundle } from '@/lib/okf/import'
import { unzipSync } from 'fflate'
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

const archiveFiles = {
  'okf-bundle/index.md': new TextEncoder().encode('okf_version: "0.2"\n'),
  'okf-bundle/concepts/ok.md': new TextEncoder().encode('# OK'),
}

const fileInputRef: RefObject<HTMLInputElement | null> = { current: null }

const withStubFileReader = (content: ArrayBuffer, run: () => void): void => {
  const originalFileReader = global.FileReader

  class StubFileReader {
    result: string | ArrayBuffer | null = null
    onload: (() => void | Promise<void>) | null = null
    onerror: (() => void) | null = null

    readAsArrayBuffer(): void {
      this.result = content
      void this.onload?.()
    }
  }

  global.FileReader = StubFileReader as unknown as typeof FileReader
  try {
    run()
  } finally {
    global.FileReader = originalFileReader
  }
}

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
  vi.mocked(unzipSync).mockReturnValue(archiveFiles)
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

    withStubFileReader(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, () => {
      const { result } = renderUseExportHandlers(setImportPreview)
      act(() => { result.current.handleFileChange(makeZipChangeEvent()) })
    })

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

    withStubFileReader(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, () => {
      const { result } = renderUseExportHandlers(setImportPreview)
      act(() => { result.current.handleFileChange(makeZipChangeEvent()) })
    })

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        'Partial import',
        expect.objectContaining({ description: expect.stringMatching(/…$/u) }),
      )
      const description = String(vi.mocked(toast.warning).mock.calls[0][1]?.description ?? '')
      expect(description.length).toBeLessThanOrEqual(320)
    })
  })
})
