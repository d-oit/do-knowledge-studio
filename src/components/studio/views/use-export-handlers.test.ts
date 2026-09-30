import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { RefObject } from 'react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('./export-types', () => ({
  todayStamp: vi.fn(() => '2026-07-26'),
  downloadFile: vi.fn(),
  downloadBlob: vi.fn(),
}))

vi.mock('./export-documents', () => ({
  buildPdfExport: vi.fn(() => new Blob(['pdf'])),
  buildDocxExport: vi.fn(() => Promise.resolve(new Blob(['docx']))),
}))

vi.mock('./export-helpers', () => ({
  buildJsonExport: vi.fn(() => '{"json":true}'),
  buildMarkdownExport: vi.fn(() => '# Markdown'),
  buildHtmlExport: vi.fn(() => '<html></html>'),
  parseImportFile: vi.fn(),
}))

vi.mock('@/lib/export/encrypt', () => ({
  encryptData: vi.fn((data: string) => Promise.resolve(`encrypted-${data}`)),
  buildEncryptedReaderHtml: vi.fn((enc: string) => `<html>${enc}</html>`),
}))

vi.mock('@/lib/okf/import', () => ({
  parseOkfBundle: vi.fn(),
}))

vi.mock('fflate', () => ({
  unzipSync: vi.fn(),
  zipSync: vi.fn(() => new Uint8Array([1, 2, 3])),
  strToU8: vi.fn((s: string) => new TextEncoder().encode(s)),
  strFromU8: vi.fn((d: Uint8Array) => new TextDecoder().decode(d)),
}))

import { useExportHandlers } from './use-export-handlers'
import { toast } from 'sonner'
import { downloadFile, downloadBlob } from './export-types'
import { buildPdfExport, buildDocxExport } from './export-documents'
import {
  buildJsonExport, buildMarkdownExport, buildHtmlExport,
  parseImportFile,
} from './export-helpers'
import { encryptData, buildEncryptedReaderHtml } from '@/lib/export/encrypt'
import { parseOkfBundle } from '@/lib/okf/import'
import { unzipSync } from 'fflate'

/** The mock entities. */
const mockEntities = [
  {
    /** Unique identifier. */
    id: 'ent-1', name: 'Test', type: 'note' as const,
    /** One-line summary of the item. */
    description: '', content: '', tags: [],
    /** ISO timestamp of claim creation. */
    createdAt: '', updatedAt: '', links: [],
  },
]

/** The mock claims. */
const mockClaims = [
  { id: 'claim-1', entityId: 'ent-1', statement: 's', confidence: 0.5, verification: 'unverified' as const },
]

/** The create file input ref. */
const createFileInputRef = (): RefObject<HTMLInputElement | null> => {
  return { current: document.createElement('input') }
}

/**
 * Runs `fn` with a synchronous StubFileReader installed that resolves
 * `readAsText`/`readAsArrayBuffer` with the given content, then always
 * restores the original FileReader.
 * @param content - Payload the stub returns from the read methods.
 * @param fn - Test body executed while the stub is installed.
 */
const withStubFileReader = (content: string | ArrayBuffer, fn: () => void): void => {
  /** The original file reader. */
  const originalFileReader = global.FileReader
  class StubFileReader {
    /** The result. */
    result: string | ArrayBuffer | null = null
    /** The onload. */
    onload: (() => void) | null = null
    /** The onerror. */
    onerror: (() => void) | null = null
    readAsText() {
      this.result = typeof content === 'string' ? content : new TextDecoder().decode(content)
      this.onload?.()
    }
    readAsArrayBuffer() {
      this.result = typeof content === 'string' ? new TextEncoder().encode(content).buffer as ArrayBuffer : content
      this.onload?.()
    }
  }
  global.FileReader = StubFileReader as unknown as typeof FileReader
  try {
    fn()
  } finally {
    global.FileReader = originalFileReader
  }
}

/** Builds a fake change event carrying the given file. */
const makeFileChangeEvent = (fileName: string, content: string): React.ChangeEvent<HTMLInputElement> => {
  /** The file. */
  const file = new File([content], fileName, { type: 'application/json' })
  /** The input. */
  const input = document.createElement('input')
  Object.defineProperty(input, 'files', { value: [file] })
  return { target: input } as React.ChangeEvent<HTMLInputElement>
}

/** Builds a staged import preview fixture for confirm-import tests. */
const makeImportPreview = () => ({
  /** Entities to serialize. */
  entities: mockEntities,
  /** The library claims being processed. */
  claims: mockClaims,
  /** Number of entities in the payload. */
  entityCount: 1,
  /** Number of claims in the payload. */
  claimCount: 1,
  /** Claim schema version. */
  version: 1,
  /** Entity ids that already exist in the library. */
  duplicateIds: [] as string[],
})

/** The render use export handlers. */
const renderUseExportHandlers = (overrides: Partial<Parameters<typeof useExportHandlers>[0]> = {}) => {
  /** The params. */
  const params = {
    /** Entities to serialize. */
    entities: mockEntities,
    /** The library claims being processed. */
    claims: mockClaims,
    importWithRollback: vi.fn(() => ({ success: true })),
    /** Store action that restores the demo dataset. */
    resetStore: vi.fn(),
    importPreview: null,
    /** Callback that stages the parsed import preview. */
    setImportPreview: vi.fn(),
    /** Ref to the hidden file input element. */
    fileInputRef: createFileInputRef(),
    ...overrides,
  }
  /** The result. */
  const result = renderHook(() => useExportHandlers(params))
  return { ...result, params }
}

describe('useExportHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns initial state values', () => {
    const { result } = renderUseExportHandlers()
    expect(result.current.showPassword).toBe(false)
    expect(result.current.password).toBe('')
    expect(result.current.confirm).toBe('')
    expect(result.current.showPass).toBe(false)
  })

  it('handleExport json calls buildJsonExport + downloadFile', async () => {
    const { result } = renderUseExportHandlers()
    await act(async () => { await result.current.handleExport('json') })
    expect(buildJsonExport).toHaveBeenCalledWith(mockEntities, mockClaims, { graph: undefined, mindMap: undefined, links: undefined, tags: undefined })
    expect(downloadFile).toHaveBeenCalledWith(
      'do-knowledge-studio-export-2026-07-26.json',
      '{"json":true}',
      'application/json',
    )
    expect(toast.success).toHaveBeenCalledWith('JSON export downloaded', expect.anything())
  })

  it('handleExport markdown calls buildMarkdownExport + downloadFile', async () => {
    const { result } = renderUseExportHandlers()
    await act(async () => { await result.current.handleExport('markdown') })
    expect(buildMarkdownExport).toHaveBeenCalledWith(mockEntities, mockClaims)
    expect(downloadFile).toHaveBeenCalledWith(
      'do-knowledge-studio-2026-07-26.md',
      '# Markdown',
      'text/markdown',
    )
    expect(toast.success).toHaveBeenCalledWith('Markdown export downloaded', expect.anything())
  })

  it('handleExport okf calls buildOkfBundle + downloadBlob', async () => {
    const { result } = renderUseExportHandlers()
    await act(async () => { await result.current.handleExport('okf') })
    expect(downloadBlob).toHaveBeenCalledWith(
      'do-knowledge-studio-okf-2026-07-26.zip',
      expect.any(Blob),
    )
    expect(toast.success).toHaveBeenCalledWith('OKF v0.2 bundle exported', expect.anything())
  })

  it('handleExport html calls buildHtmlExport + downloadFile', async () => {
    const { result } = renderUseExportHandlers()
    await act(async () => { await result.current.handleExport('html') })
    expect(buildHtmlExport).toHaveBeenCalledWith(mockEntities, mockClaims)
    expect(downloadFile).toHaveBeenCalledWith(
      'do-knowledge-studio-2026-07-26.html',
      '<html></html>',
      'text/html',
    )
    expect(toast.success).toHaveBeenCalledWith('HTML export downloaded', expect.anything())
  })

  it('handleExport pdf calls buildPdfExport + downloadBlob', async () => {
    const { result } = renderUseExportHandlers()
    await act(async () => { await result.current.handleExport('pdf') })
    expect(buildPdfExport).toHaveBeenCalledWith(mockEntities, mockClaims)
    expect(downloadBlob).toHaveBeenCalledWith('do-knowledge-studio-2026-07-26.pdf', expect.any(Blob))
    expect(toast.success).toHaveBeenCalledWith('PDF export downloaded', expect.anything())
  })

  it('handleExport pdf shows error on failure', async () => {
    vi.mocked(buildPdfExport).mockImplementation(() => { throw new Error('pdf fail') })
    const { result } = renderUseExportHandlers()
    await act(async () => { await result.current.handleExport('pdf') })
    expect(toast.error).toHaveBeenCalledWith('PDF export failed', { description: 'pdf fail' })
  })

  it('handleExport docx calls buildDocxExport + downloadBlob', async () => {
    const { result } = renderUseExportHandlers()
    await act(async () => { await result.current.handleExport('docx') })
    expect(buildDocxExport).toHaveBeenCalledWith(mockEntities, mockClaims)
    expect(downloadBlob).toHaveBeenCalledWith('do-knowledge-studio-2026-07-26.docx', expect.any(Blob))
    expect(toast.success).toHaveBeenCalledWith('DOCX export downloaded', expect.anything())
  })

  it('handleExport encrypted with matching passwords calls encryptData', async () => {
    const { result } = renderUseExportHandlers()
    act(() => {
      result.current.setPassword('secret')
      result.current.setConfirm('secret')
    })
    await act(async () => { await result.current.handleExport('encrypted') })
    expect(encryptData).toHaveBeenCalledWith('{"json":true}', 'secret')
    expect(buildEncryptedReaderHtml).toHaveBeenCalled()
    expect(downloadFile).toHaveBeenCalledWith(
      'do-knowledge-studio-encrypted-2026-07-26.html',
      expect.any(String),
      'text/html',
    )
    expect(toast.success).toHaveBeenCalledWith('Encrypted export downloaded', expect.anything())
  })

  it('handleExport encrypted with mismatched passwords shows error', async () => {
    const { result } = renderUseExportHandlers()
    act(() => {
      result.current.setPassword('secret')
      result.current.setConfirm('other')
    })
    await act(async () => { await result.current.handleExport('encrypted') })
    expect(toast.error).toHaveBeenCalledWith('Password fields must match and not be empty.')
    expect(encryptData).not.toHaveBeenCalled()
  })

  it('handleExport encrypted with empty passwords shows error', async () => {
    const { result } = renderUseExportHandlers()
    await act(async () => { await result.current.handleExport('encrypted') })
    expect(toast.error).toHaveBeenCalledWith('Password fields must match and not be empty.')
  })

  it('handleImportClick triggers file input click', () => {
    /** Ref to the hidden file input element. */
    const fileInputRef = createFileInputRef()
    /** The click spy. */
    const clickSpy = vi.spyOn(fileInputRef.current!, 'click')
    const { result } = renderUseExportHandlers({ fileInputRef })
    act(() => { result.current.handleImportClick() })
    expect(clickSpy).toHaveBeenCalled()
  })

  it('handleConfirmImport calls importWithRollback with preview data', () => {
    /** Store action that commits an import with rollback on failure. */
    const importWithRollback = vi.fn(() => ({ success: true }))
    /** Callback that stages the parsed import preview. */
    const setImportPreview = vi.fn()
    /** The preview. */
    const preview = makeImportPreview()
    const { result } = renderUseExportHandlers({
      importPreview: preview, setImportPreview, importWithRollback,
    })
    act(() => { result.current.handleConfirmImport() })
    expect(importWithRollback).toHaveBeenCalledWith(mockEntities, mockClaims, { graph: undefined, mindMap: undefined, links: undefined, tags: undefined })
    expect(setImportPreview).toHaveBeenCalledWith(null)
    expect(toast.success).toHaveBeenCalledWith('Import complete', expect.anything())
  })

  it('handleConfirmImport shows error when rollback fails', () => {
    /** Store action that commits an import with rollback on failure. */
    const importWithRollback = vi.fn(() => ({ success: false, error: 'bad data' }))
    /** Callback that stages the parsed import preview. */
    const setImportPreview = vi.fn()
    /** The preview. */
    const preview = makeImportPreview()
    const { result } = renderUseExportHandlers({
      importPreview: preview, setImportPreview, importWithRollback,
    })
    act(() => { result.current.handleConfirmImport() })
    expect(toast.error).toHaveBeenCalledWith('Import failed — state restored', { description: 'bad data' })
    expect(setImportPreview).toHaveBeenCalledWith(null)
  })

  it('handleConfirmImport returns early when no importPreview', () => {
    /** Store action that commits an import with rollback on failure. */
    const importWithRollback = vi.fn()
    const { result } = renderUseExportHandlers({ importPreview: null, importWithRollback })
    act(() => { result.current.handleConfirmImport() })
    expect(importWithRollback).not.toHaveBeenCalled()
  })

  it('handleReset calls resetStore', () => {
    /** Store action that restores the demo dataset. */
    const resetStore = vi.fn()
    const { result } = renderUseExportHandlers({ resetStore })
    act(() => { result.current.handleReset() })
    expect(resetStore).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Restored to demo data', expect.anything())
  })

  it('handleFileChange sets import preview on successful parse', () => {
    /** Callback that stages the parsed import preview. */
    const setImportPreview = vi.fn()
    /** The imported entities. */
    const importedEntities = [
      { id: 'new-1', name: 'New', type: 'note' as const, description: '', content: '', tags: [], createdAt: '', updatedAt: '', links: [] },
    ]
    /** The imported claims. */
    const importedClaims = [
      { id: 'new-claim', entityId: 'new-1', statement: 'New claim', confidence: 0.5, verification: 'unverified' as const },
    ]
    vi.mocked(parseImportFile).mockReturnValue({
      /** Whether the operation succeeded. */
      success: true, entities: importedEntities, claims: importedClaims, errors: [],
    })

    withStubFileReader('file-content', () => {
      const { result } = renderUseExportHandlers({ setImportPreview })
      act(() => {
        result.current.handleFileChange(makeFileChangeEvent('import.json', 'content'))
      })

      expect(parseImportFile).toHaveBeenCalledWith('file-content')
      expect(setImportPreview).toHaveBeenCalledWith(expect.objectContaining({
        /** Entities to serialize. */
        entities: importedEntities,
        /** The library claims being processed. */
        claims: importedClaims,
        /** Number of entities in the payload. */
        entityCount: 1,
        /** Number of claims in the payload. */
        claimCount: 1,
        /** Entity ids that already exist in the library. */
        duplicateIds: [],
      }))
    })
  })

  it('handleFileChange shows error when parse fails', () => {
    vi.mocked(parseImportFile).mockReturnValue({
      /** Whether the operation succeeded. */
      success: false, entities: [], claims: [],
      /** The errors. */
      errors: [{ path: 'entities[0]', message: 'Invalid type' }],
    })

    withStubFileReader('bad-data', () => {
      const { result } = renderUseExportHandlers()
      act(() => {
        result.current.handleFileChange(makeFileChangeEvent('bad.json', 'bad'))
      })

      expect(parseImportFile).toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith('Import failed', {
        /** One-line summary of the item. */
        description: 'entities[0]: Invalid type',
      })
    })
  })

  it('handleFileChange detects duplicate entity IDs', () => {
    /** Callback that stages the parsed import preview. */
    const setImportPreview = vi.fn()
    /** The imported entities. */
    const importedEntities = [
      { id: 'ent-1', name: 'Existing', type: 'note' as const, description: '', content: '', tags: [], createdAt: '', updatedAt: '', links: [] },
    ]
    vi.mocked(parseImportFile).mockReturnValue({
      /** Whether the operation succeeded. */
      success: true, entities: importedEntities, claims: [], errors: [],
    })

    withStubFileReader('file-content', () => {
      const { result } = renderUseExportHandlers({ setImportPreview })
      act(() => {
        result.current.handleFileChange(makeFileChangeEvent('import.json', 'content'))
      })

      expect(setImportPreview).toHaveBeenCalledWith(expect.objectContaining({
        /** Entity ids that already exist in the library. */
        duplicateIds: ['ent-1'],
      }))
    })
  })

  it('handleFileChange warns on partial OKF import errors', () => {
    /** Callback that stages the parsed import preview. */
    const setImportPreview = vi.fn()
    /** The imported entities. */
    const importedEntities = [
      { id: 'new-1', name: 'New', type: 'note' as const, description: '', content: '', tags: [], createdAt: '', updatedAt: '', links: [] },
    ]
    vi.mocked(unzipSync).mockReturnValue({
      'okf-bundle/index.md': new TextEncoder().encode('okf_version: "0.2"\n'),
      'okf-bundle/concepts/ok.md': new TextEncoder().encode('# OK'),
    } as unknown as ReturnType<typeof unzipSync>)
    vi.mocked(parseOkfBundle).mockReturnValue({
      /** Entities to serialize. */
      entities: importedEntities,
      /** The library claims being processed. */
      claims: [],
      /** The errors. */
      errors: ['broken.md: invalid YAML frontmatter'],
    })

    withStubFileReader(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, () => {
      const { result } = renderUseExportHandlers({ setImportPreview })
      act(() => {
        result.current.handleFileChange(makeFileChangeEvent('import.zip', 'content'))
      })

      expect(toast.warning).toHaveBeenCalledWith('Partial import', expect.anything())
      expect(setImportPreview).toHaveBeenCalledWith(expect.objectContaining({
        /** Entities to serialize. */
        entities: importedEntities,
      }))
    })
  })

  it('handleFileChange truncates long partial OKF error lists in the warning toast', () => {
    /** Callback that stages the parsed import preview. */
    const setImportPreview = vi.fn()
    /** The imported entities. */
    const importedEntities = [
      { id: 'new-1', name: 'New', type: 'note' as const, description: '', content: '', tags: [], createdAt: '', updatedAt: '', links: [] },
    ]
    vi.mocked(unzipSync).mockReturnValue({
      'okf-bundle/index.md': new TextEncoder().encode('okf_version: "0.2"\n'),
      'okf-bundle/concepts/ok.md': new TextEncoder().encode('# OK'),
    } as unknown as ReturnType<typeof unzipSync>)
    /** The long error list. */
    const longErrors = Array.from(
      { length: 40 },
      (_, i) => `file-${i}.md: invalid YAML frontmatter with a verbose diagnostic message that keeps going on`, // prettier-ignore
    )
    vi.mocked(parseOkfBundle).mockReturnValue({
      /** Entities to serialize. */
      entities: importedEntities,
      /** The library claims being processed. */
      claims: [],
      /** The errors. */
      errors: longErrors,
    })

    withStubFileReader(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, () => {
      const { result } = renderUseExportHandlers({ setImportPreview })
      act(() => {
        result.current.handleFileChange(makeFileChangeEvent('import.zip', 'content'))
      })

      expect(toast.warning).toHaveBeenCalledWith(
        'Partial import',
        expect.objectContaining({ description: expect.stringMatching(/…$/u) }),
      )
      // The truncated message must stay within the character budget.
      /** The called description. */
      const description = vi.mocked(toast.warning).mock.calls[0][1]?.description ?? ''
      expect(description.length).toBeLessThanOrEqual(320)
    })
  })

  it('handleFileChange returns early when no file selected', () => {
    const { result } = renderUseExportHandlers()
    /** The input. */
    const input = document.createElement('input')
    Object.defineProperty(input, 'files', { value: [] })

    act(() => {
      result.current.handleFileChange({ target: input } as React.ChangeEvent<HTMLInputElement>)
    })

    expect(parseImportFile).not.toHaveBeenCalled()
  })
})