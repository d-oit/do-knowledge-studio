import { useState } from 'react'
import { toast } from 'sonner'
import type { Entity, Claim } from '@/lib/studio/types'
import type { ImportPreview, ExportFormatId, ExportOptions } from './export-types'
import { todayStamp, downloadFile, downloadBlob } from './export-types'
import {
  buildJsonExport, buildMarkdownExport, buildHtmlExport,
  parseImportFile,
} from './export-helpers'
import { buildPdfExport, buildDocxExport } from './export-documents'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { buildOkfBundle } from '@/lib/okf/bundle'
import { parseOkfBundle } from '@/lib/okf/import'
import { encryptData, buildEncryptedReaderHtml } from '@/lib/export/encrypt'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from '@/lib/studio/schema'

/**
 * Builds a human-readable summary string of export contents.
 * @param entityCount - Number of entities.
 * @param claimCount - Number of claims.
 * @param graph - Optional graph payload (adds node count).
 * @param mindMap - Optional mind map payload (adds node count).
 * @param links - Optional links (adds link count).
 * @param tags - Optional tags (adds tag count).
 * @returns A `·`-joined summary string.
 */
const buildExportSummary = (
  entityCount: number,
  claimCount: number,
  graph?: ValidatedGraph,
  mindMap?: ValidatedMindMap,
  links?: ValidatedLink[],
  tags?: ValidatedTag[],
): string => {
  /** The parts. */
  const parts = [`${entityCount} entities`, `${claimCount} claims`]
  if (graph?.nodes?.length) parts.push(`${graph.nodes.length} graph nodes`)
  if (mindMap?.nodes?.length) parts.push(`${mindMap.nodes.length} mind map nodes`)
  if (links?.length) parts.push(`${links.length} links`)
  if (tags?.length) parts.push(`${tags.length} tags`)
  return parts.join(' · ')
}

/** Outcome of an import-with-rollback store operation. */
interface ImportRollbackResult {
  /** Whether the operation succeeded. */
  success: boolean
  /** Optional error message when the operation failed. */
  error?: string
}

/** Inputs consumed by the export/import handlers hook. */
interface UseExportHandlersParams {
  /** Entities to serialize. */
  entities: Entity[]
  /** The library claims being processed. */
  claims: Claim[]
  /** Optional graph payload carried through the operation. */
  graph?: ValidatedGraph
  /** Optional mind map payload carried through the operation. */
  mindMap?: ValidatedMindMap
  /** Related entity links. */
  links?: ValidatedLink[]
  /** Optional tags payload carried through the operation. */
  tags?: ValidatedTag[]
  /** Store action that commits an import with rollback on failure. */
  importWithRollback: (entities: Entity[], claims: Claim[], options?: ExportOptions) => ImportRollbackResult
  /** Store action that restores the demo dataset. */
  resetStore: () => void
  /** Currently staged import preview (or null). */
  importPreview: ImportPreview | null
  /** Callback that stages the parsed import preview. */
  setImportPreview: (preview: ImportPreview | null) => void
  /** Ref to the hidden file input element. */
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

/** Handlers and password state exposed to the export view. */
export interface UseExportHandlersReturn {
  /** The handle export. */
  handleExport: (format: ExportFormatId) => Promise<void>
  /** The handle import click. */
  handleImportClick: () => void
  /** The handle file change. */
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** The handle confirm import. */
  handleConfirmImport: () => void
  /** The handle reset. */
  handleReset: () => void
  /** Whether the password modal is open. */
  showPassword: boolean
  /** State setter for password modal visibility. */
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
  /** Password used for the encrypted export. */
  password: string
  /** State setter for the password field. */
  setPassword: React.Dispatch<React.SetStateAction<string>>
  /** Password confirmation value. */
  confirm: string
  /** State setter for the confirmation field. */
  setConfirm: React.Dispatch<React.SetStateAction<string>>
  /** Whether the password fields are visible. */
  showPass: boolean
  /** State setter for password visibility. */
  setShowPass: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Reads an OKF v0.2 .zip bundle and stages it for import preview.
 * Non-OKF zips and unreadable files surface a toast instead of throwing.
 * @param file - The selected .zip file.
 * @param entities - Current library entities (for duplicate detection).
 * @param setImportPreview - Callback that stages the parsed preview.
 */
const handleOkfZipImport = (
  file: File,
  entities: Entity[],
  setImportPreview: (preview: ImportPreview | null) => void,
) => {
  /** The reader. */
  const reader = new FileReader()
  reader.onload = () => {
    try {
      /** The buffer. */
      const buffer = reader.result as ArrayBuffer
      /** The entries. */
      const entries = unzipSync(new Uint8Array(buffer))
      /** The files map. */
      const filesMap = new Map<string, string>()
      for (const [p, data] of Object.entries(entries)) {
        if (p.endsWith('.md')) {
          filesMap.set(p.replace(/^okf-bundle\//, ''), strFromU8(data))
        }
      }
      /** The root index. */
      const rootIndex = filesMap.get('index.md') ?? ''
      if (!rootIndex.includes('okf_version')) {
        toast.error('Import failed', { description: 'zip does not contain an OKF bundle (no okf_version in index.md)' })
        return
      }
      const { entities: ents, claims: cls, errors } = parseOkfBundle(filesMap)
      if (errors.length > 0 && ents.length === 0) {
        toast.error('Import failed', { description: errors.join('; ') })
        return
      }
      /** The existing ids. */
      const existingIds = new Set(entities.map((ent) => ent.id))
      setImportPreview({
        entities: ents, claims: cls,
        entityCount: ents.length,
        claimCount: cls.length, version: 1,
        duplicateIds: ents.filter((ent) => existingIds.has(ent.id)).map((ent) => ent.id),
      })
    } catch (err) {
      toast.error('Import failed', { description: err instanceof Error ? err.message : 'Could not unzip OKF bundle.' })
    }
  }
  reader.onerror = () => { toast.error('Import failed', { description: 'Could not read the file.' }) }
  reader.readAsArrayBuffer(file)
}

/**
 * Hook providing all export, import, and reset handlers for the export view.
 * @param entities - Library entities.
 * @param claims - Library claims.
 * @param graph - Optional graph payload for export/import round-trips.
 * @param mindMap - Optional mind map payload.
 * @param links - Optional links payload.
 * @param tags - Optional tags payload.
 * @param importWithRollback - Store action committing staged imports with rollback.
 * @param resetStore - Store action restoring demo data.
 * @param importPreview - Currently staged import preview (or null).
 * @param setImportPreview - Sets the staged import preview.
 * @param fileInputRef - Ref to the hidden file input.
 * @returns The export/import handlers and password modal state.
 */
export const useExportHandlers = ({
  entities, claims, graph, mindMap, links, tags, importWithRollback, resetStore,
  importPreview, setImportPreview, fileInputRef,
}: UseExportHandlersParams): UseExportHandlersReturn => {
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)

  /** The export options. */
  const exportOptions: ExportOptions = { graph, mindMap, links, tags }
  /** The stamp. */
  const stamp = todayStamp()

  /** Downloads the library as a JSON backup file. */
  const handleExportJson = () => {
    /** Markdown or text content. */
    const content = buildJsonExport(entities, claims, exportOptions)
    downloadFile(`do-knowledge-studio-export-${stamp}.json`, content, 'application/json')
    toast.success('JSON export downloaded', { description: buildExportSummary(entities.length, claims.length, graph, mindMap, links, tags) })
  }

  /** Downloads the library as a single Markdown file. */
  const handleExportMarkdown = () => {
    /** Markdown or text content. */
    const content = buildMarkdownExport(entities, claims)
    downloadFile(`do-knowledge-studio-${stamp}.md`, content, 'text/markdown')
    toast.success('Markdown export downloaded', { description: `${entities.length} entities concatenated into one .md file` })
  }

  /** Downloads the library as a self-contained static HTML page. */
  const handleExportHtml = () => {
    /** Markdown or text content. */
    const content = buildHtmlExport(entities, claims)
    downloadFile(`do-knowledge-studio-${stamp}.html`, content, 'text/html')
    toast.success('HTML export downloaded', { description: 'Self-contained .html page — open in any browser.' })
  }

  /** Downloads a print-ready PDF of all entities and claims. */
  const handleExportPdf = () => {
    try {
      /** The blob. */
      const blob = buildPdfExport(entities, claims)
      downloadBlob(`do-knowledge-studio-${stamp}.pdf`, blob)
      toast.success('PDF export downloaded', { description: `${entities.length} entities formatted in a print-ready PDF.` })
    } catch (err) {
      toast.error('PDF export failed', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  /** Downloads the library as an OKF v0.2 zip bundle (index, log, concept files). */
  const handleExportOkf = () => {
    try {
      /** The edges. */
      const edges = graph?.edges ?? []
      /** The bundle. */
      const bundle = buildOkfBundle(entities, claims, edges, '0.1.0')
      /** The files record. */
      const filesRecord: Record<string, Uint8Array> = {}
      for (const f of bundle.files) {
        filesRecord[`okf-bundle/${f.path}`] = strToU8(f.content)
      }
      /** The zipped. */
      const zipped = zipSync(filesRecord)
      downloadBlob(
        `do-knowledge-studio-okf-${stamp}.zip`,
        new Blob([zipped], { type: 'application/zip' }),
      )
      toast.success('OKF v0.2 bundle exported', {
        description: `${bundle.files.length} files — consumable by any OKF-aware agent, no SDK required`,
      })
    } catch (err) {
      toast.error('OKF export failed', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  /** Downloads a Word (.docx) document of all entities and claims. */
  const handleExportDocx = async () => {
    try {
      /** The blob. */
      const blob = await buildDocxExport(entities, claims)
      downloadBlob(`do-knowledge-studio-${stamp}.docx`, blob)
      toast.success('DOCX export downloaded', { description: `${entities.length} entities in a Word document.` })
    } catch (err) {
      toast.error('DOCX export failed', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  /** Downloads a password-encrypted self-contained HTML reader. */
  const handleExportEncrypted = async () => {
    if (!password || password !== confirm) {
      toast.error('Password fields must match and not be empty.')
      return
    }
    try {
      /** The json. */
      const json = buildJsonExport(entities, claims, exportOptions)
      /** The encrypted. */
      const encrypted = await encryptData(json, password)
      /** The html. */
      const html = buildEncryptedReaderHtml(encrypted)
      // Safe: HTML is downloaded as a file (Blob → anchor.click), not executed in DOM.
      // buildEncryptedReaderHtml generates a self-contained reader with CSP headers.
      downloadFile(`do-knowledge-studio-encrypted-${stamp}.html`, html, 'text/html')
      toast.success('Encrypted export downloaded', { description: 'AES-256-GCM encrypted with PBKDF2 key derivation.' })
    } catch (err) {
      toast.error('Encrypted export failed', { description: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setShowPassword(false)
      setPassword('')
      setConfirm('')
    }
  }

  /** Routes an export-format id to its download handler. */
  const handleExport = async (format: ExportFormatId) => {
    switch (format) {
      case 'json':
        handleExportJson()
        break
      case 'markdown':
        handleExportMarkdown()
        break
      case 'html':
        handleExportHtml()
        break
      case 'pdf':
        handleExportPdf()
        break
      case 'docx':
        await handleExportDocx()
        break
      case 'encrypted':
        await handleExportEncrypted()
        break
      case 'okf':
        handleExportOkf()
        break
      /** The default. */
      default:
        break
    }
  }

  /** Opens the hidden file picker for import. */
  const handleImportClick = () => { fileInputRef.current?.click() }

  /** Stages a selected JSON or OKF zip file for the import preview. */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    /** The file. */
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.name.endsWith('.zip')) {
      handleOkfZipImport(file, entities, setImportPreview)
    } else {
      /** The reader. */
      const reader = new FileReader()
      reader.onload = () => {
        /** The text. */
        const text = String(reader.result || '')
        /** The result. */
        const result = parseImportFile(text)
        if (!result.success) {
          toast.error('Import failed', { description: result.errors.map((err) => `${err.path}: ${err.message}`).join('; ') })
          return
        }
        const { entities: ents, claims: cls, graph: g, mindMap: m, links: l, tags: t } = result
        /** The existing ids. */
        const existingIds = new Set(entities.map((ent) => ent.id))
        setImportPreview({
          entities: ents, claims: cls, graph: g, mindMap: m, links: l, tags: t,
          entityCount: ents.length,
          claimCount: cls.length, version: 1,
          duplicateIds: ents.filter((ent) => existingIds.has(ent.id)).map((ent) => ent.id),
        })
      }
      reader.onerror = () => { toast.error('Import failed', { description: 'Could not read the file.' }) }
      reader.readAsText(file)
    }
  }

  /** Commits the staged import preview into the store with rollback on failure. */
  const handleConfirmImport = () => {
    if (!importPreview) return
    /** The result. */
    const result = importWithRollback(
      importPreview.entities,
      importPreview.claims,
      { graph: importPreview.graph, mindMap: importPreview.mindMap, links: importPreview.links, tags: importPreview.tags },
    )
    if (result.success) {
      /** The summary. */
      const summary = buildExportSummary(
        importPreview.entityCount,
        importPreview.claimCount,
        importPreview.graph,
        importPreview.mindMap,
        importPreview.links,
        importPreview.tags,
      )
      toast.success('Import complete', {
        description: `${summary} replaced the current library.`,
      })
    } else {
      toast.error('Import failed — state restored', { description: result.error })
    }
    setImportPreview(null)
  }

  /** Restores the store to the demo seed dataset. */
  const handleReset = () => {
    resetStore()
    toast.success('Restored to demo data', { description: 'All entities and claims have been reset to the seed dataset.' })
  }

  return {
    handleExport, handleImportClick, handleFileChange, handleConfirmImport, handleReset,
    showPassword, setShowPassword, password, setPassword, confirm, setConfirm, showPass, setShowPass,
  }
}