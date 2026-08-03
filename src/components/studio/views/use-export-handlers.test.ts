import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { RefObject } from 'react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('./export-helpers', () => ({
  todayStamp: vi.fn(() => '2026-07-26'),
  downloadFile: vi.fn(),
  downloadBlob: vi.fn(),
  buildJsonExport: vi.fn(() => '{"json":true}'),
  buildMarkdownExport: vi.fn(() => '# Markdown'),
  buildHtmlExport: vi.fn(() => '<html></html>'),
  buildPdfExport: vi.fn(() => new Blob(['pdf'])),
  buildDocxExport: vi.fn(async () => new Blob(['docx'])),
  parseImportFile: vi.fn(),
}))

vi.mock('@/lib/export/encrypt', () => ({
  encryptData: vi.fn(async (data: string) => `encrypted-${data}`),
  buildEncryptedReaderHtml: vi.fn((enc: string) => `<html>${enc}</html>`),
}))

import { useExportHandlers } from './use-export-handlers'
import { toast } from 'sonner'
import {
  downloadFile, downloadBlob,
  buildJsonExport, buildMarkdownExport, buildHtmlExport,
  buildPdfExport, buildDocxExport, parseImportFile,
} from './export-helpers'
import { encryptData, buildEncryptedReaderHtml } from '@/lib/export/encrypt'

const mockEntities = [
  {
    id: 'ent-1', name: 'Test', type: 'note' as const,
    description: '', content: '', tags: [],
    createdAt: '', updatedAt: '', links: [],
  },
]

const mockClaims = [
  { id: 'claim-1', entityId: 'ent-1', statement: 's', confidence: 0.5, verification: 'unverified' as const },
]

function createFileInputRef(): RefObject<HTMLInputElement | null> {
  return { current: document.createElement('input') }
}

function renderUseExportHandlers(overrides: Partial<Parameters<typeof useExportHandlers>[0]> = {}) {
  const params = {
    entities: mockEntities,
    claims: mockClaims,
    importWithRollback: vi.fn(() => ({ success: true })),
    resetStore: vi.fn(),
    importPreview: null,
    setImportPreview: vi.fn(),
    fileInputRef: createFileInputRef(),
    ...overrides,
  }
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
    expect(buildJsonExport).toHaveBeenCalledWith(mockEntities, mockClaims, undefined, undefined, undefined, undefined)
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
      expect.stringContaining('<html>'),
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
    const fileInputRef = createFileInputRef()
    const clickSpy = vi.spyOn(fileInputRef.current!, 'click')
    const { result } = renderUseExportHandlers({ fileInputRef })
    act(() => { result.current.handleImportClick() })
    expect(clickSpy).toHaveBeenCalled()
  })

  it('handleConfirmImport calls importWithRollback with preview data', () => {
    const importWithRollback = vi.fn(() => ({ success: true }))
    const setImportPreview = vi.fn()
    const preview = {
      entities: mockEntities, claims: mockClaims,
      entityCount: 1, claimCount: 1, version: 1, duplicateIds: [],
    }
    const { result } = renderUseExportHandlers({
      importPreview: preview, setImportPreview, importWithRollback,
    })
    act(() => { result.current.handleConfirmImport() })
    expect(importWithRollback).toHaveBeenCalledWith(mockEntities, mockClaims, undefined, undefined, undefined, undefined)
    expect(setImportPreview).toHaveBeenCalledWith(null)
    expect(toast.success).toHaveBeenCalledWith('Import complete', expect.anything())
  })

  it('handleConfirmImport shows error when rollback fails', () => {
    const importWithRollback = vi.fn(() => ({ success: false, error: 'bad data' }))
    const setImportPreview = vi.fn()
    const preview = {
      entities: mockEntities, claims: mockClaims,
      entityCount: 1, claimCount: 1, version: 1, duplicateIds: [],
    }
    const { result } = renderUseExportHandlers({
      importPreview: preview, setImportPreview, importWithRollback,
    })
    act(() => { result.current.handleConfirmImport() })
    expect(toast.error).toHaveBeenCalledWith('Import failed — state restored', { description: 'bad data' })
    expect(setImportPreview).toHaveBeenCalledWith(null)
  })

  it('handleConfirmImport returns early when no importPreview', () => {
    const importWithRollback = vi.fn()
    const { result } = renderUseExportHandlers({ importPreview: null, importWithRollback })
    act(() => { result.current.handleConfirmImport() })
    expect(importWithRollback).not.toHaveBeenCalled()
  })

  it('handleReset calls resetStore', () => {
    const resetStore = vi.fn()
    const { result } = renderUseExportHandlers({ resetStore })
    act(() => { result.current.handleReset() })
    expect(resetStore).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Restored to demo data', expect.anything())
  })

  it('handleFileChange sets import preview on successful parse', async () => {
    const setImportPreview = vi.fn()
    const importedEntities = [
      { id: 'new-1', name: 'New', type: 'note' as const, description: '', content: '', tags: [], createdAt: '', updatedAt: '', links: [] },
    ]
    const importedClaims = [
      { id: 'new-claim', entityId: 'new-1', statement: 'New claim', confidence: 0.5, verification: 'unverified' as const },
    ]
    vi.mocked(parseImportFile).mockReturnValue({
      success: true, entities: importedEntities, claims: importedClaims, errors: [],
    })

    // Stub FileReader to call onload synchronously with test data
    const OriginalFileReader = global.FileReader
    class StubFileReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsText() {
        this.result = 'file-content'
        this.onload?.()
      }
    }
    global.FileReader = StubFileReader as unknown as typeof FileReader

    const { result } = renderUseExportHandlers({ setImportPreview })

    const file = new File(['content'], 'import.json', { type: 'application/json' })
    const input = document.createElement('input')
    Object.defineProperty(input, 'files', { value: [file] })

    act(() => {
      result.current.handleFileChange({ target: input } as React.ChangeEvent<HTMLInputElement>)
    })

    expect(parseImportFile).toHaveBeenCalledWith('file-content')
    expect(setImportPreview).toHaveBeenCalledWith(expect.objectContaining({
      entities: importedEntities,
      claims: importedClaims,
      entityCount: 1,
      claimCount: 1,
      duplicateIds: [],
    }))

    global.FileReader = OriginalFileReader
  })

  it('handleFileChange shows error when parse fails', async () => {
    vi.mocked(parseImportFile).mockReturnValue({
      success: false, entities: [], claims: [],
      errors: [{ path: 'entities[0]', message: 'Invalid type' }],
    })

    const OriginalFileReader = global.FileReader
    class StubFileReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsText() {
        this.result = 'bad-data'
        this.onload?.()
      }
    }
    global.FileReader = StubFileReader as unknown as typeof FileReader

    const { result } = renderUseExportHandlers()

    const file = new File(['bad'], 'bad.json', { type: 'application/json' })
    const input = document.createElement('input')
    Object.defineProperty(input, 'files', { value: [file] })

    act(() => {
      result.current.handleFileChange({ target: input } as React.ChangeEvent<HTMLInputElement>)
    })

    expect(parseImportFile).toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Import failed', {
      description: 'entities[0]: Invalid type',
    })

    global.FileReader = OriginalFileReader
  })

  it('handleFileChange detects duplicate entity IDs', async () => {
    const setImportPreview = vi.fn()
    const importedEntities = [
      { id: 'ent-1', name: 'Existing', type: 'note' as const, description: '', content: '', tags: [], createdAt: '', updatedAt: '', links: [] },
    ]
    vi.mocked(parseImportFile).mockReturnValue({
      success: true, entities: importedEntities, claims: [], errors: [],
    })

    const OriginalFileReader = global.FileReader
    class StubFileReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsText() {
        this.result = 'file-content'
        this.onload?.()
      }
    }
    global.FileReader = StubFileReader as unknown as typeof FileReader

    const { result } = renderUseExportHandlers({ setImportPreview })

    const file = new File(['content'], 'import.json', { type: 'application/json' })
    const input = document.createElement('input')
    Object.defineProperty(input, 'files', { value: [file] })

    act(() => {
      result.current.handleFileChange({ target: input } as React.ChangeEvent<HTMLInputElement>)
    })

    expect(setImportPreview).toHaveBeenCalledWith(expect.objectContaining({
      duplicateIds: ['ent-1'],
    }))

    global.FileReader = OriginalFileReader
  })

  it('handleFileChange returns early when no file selected', () => {
    const { result } = renderUseExportHandlers()
    const input = document.createElement('input')
    Object.defineProperty(input, 'files', { value: [] })

    act(() => {
      result.current.handleFileChange({ target: input } as React.ChangeEvent<HTMLInputElement>)
    })

    expect(parseImportFile).not.toHaveBeenCalled()
  })
})
