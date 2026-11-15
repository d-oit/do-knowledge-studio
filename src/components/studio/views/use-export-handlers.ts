import { useRef, useState } from 'react'
import { toast } from 'sonner'
import packageJson from '../../../../package.json'
import type { Entity, Claim } from '@/lib/studio/types'
import type { ImportOutcome } from '@/lib/studio/store-types'
import type { LibraryPayload, ImportPreview, ExportFormatId, ExportOptions } from './export-types'
import { todayStamp, downloadFile, downloadBlob } from './export-types'
import {
  buildMarkdownExport, buildHtmlExport, parseImportFile, buildJsonExport, checkImportSize,
} from './export-helpers'
import { buildExportSummary, exportLibraryJson } from './export-library-json'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as announceT } from '@/lib/i18n/messages/announce'
import { translate as exportT } from '@/lib/i18n/messages/export'
import type { RecoveryPersistFailure } from '@/lib/studio/recovery-helpers'
import { isNonJsonPick, stagePickedNonJsonFiles } from './import-staging'

/** Refused-backup copy per reason, read from the export message scope. */
const NO_BACKUP_COPY: Record<RecoveryPersistFailure, string> = {
  'too-large': exportT('export.import.noBackupTooLarge'),
  unserializable: exportT('export.import.noBackupUnserializable'),
  'storage-unavailable': exportT('export.import.noBackupStorageUnavailable'),
}


/**
 * Re-exported from the vault-zip module so existing import sites (and the
 * sanitize unit tests) keep working; the implementation moved next to the
 * streaming zip reader that also depends on it.
 */
export { sanitizeZipPath } from '@/lib/import/vault-zip'

/** Inputs consumed by the export/import handlers hook. */
interface UseExportHandlersParams extends LibraryPayload {
  /** Store action that commits an import with rollback on failure. */
  importWithRollback: (entities: Entity[], claims: Claim[], options?: ExportOptions) => ImportOutcome
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
  handleExport: (format: ExportFormatId) => Promise<void>
  /** The format whose export is still running, or null when idle. */
  exportingFormat: ExportFormatId | null
  handleImportClick: () => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleConfirmImport: () => void
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
  // ONE slot holding the running format, not a per-format flag set: an export
  // is a single-shot action, two concurrent downloads of the same library are
  // never intended, and knowing *which* format runs is what the UI needs to
  // disable the control that started it and label the busy region. A set would
  // add states (two formats at once) nothing can act on.
  const [exportingFormat, setExportingFormat] = useState<ExportFormatId | null>(null)
  // The state above drives the UI; this ref is the re-entry guard. Two clicks
  // dispatched in the same task (a double-click, or a submit fired while the
  // state update is still batched) would both read the pre-update state and
  // download twice.
  const exportInFlightRef = useRef(false)
  const announce = useAnnouncer()

  const exportOptions: ExportOptions = { graph, mindMap, links, tags }
  const stamp = todayStamp()

  /** Downloads the library as a JSON backup file. */
  const handleExportJson = () => {
    exportLibraryJson({ entities, claims, graph, mindMap, links, tags })
  }

  /** Downloads the library as a single Markdown file. */
  const handleExportMarkdown = () => {
    /** Markdown or text content. */
    const content = buildMarkdownExport(entities, claims)
    downloadFile(`do-knowledge-studio-${stamp}.md`, content, 'text/markdown')
    toast.success(exportT('export.download.markdown'), { description: exportT('export.download.markdownBody', String(entities.length)) })
  }

  /** Downloads the library as a self-contained static HTML page. */
  const handleExportHtml = () => {
    /** Markdown or text content. */
    const content = buildHtmlExport(entities, claims)
    downloadFile(`do-knowledge-studio-${stamp}.html`, content, 'text/html')
    toast.success(exportT('export.download.html'), { description: exportT('export.download.htmlBody') })
  }

  /** Downloads a print-ready PDF of all entities and claims. */
  const handleExportPdf = async () => {
    try {
      /** The PDF builder. */
      const { buildPdfExport } = await import('./export-documents')
      /** The blob. Awaited so a builder that performs async work (and the
       *  export's busy state) covers the whole build, not just its call. */
      const blob = await buildPdfExport(entities, claims)
      downloadBlob(`do-knowledge-studio-${stamp}.pdf`, blob)
      toast.success(exportT('export.download.pdf'), { description: exportT('export.download.pdfBody', String(entities.length)) })
    } catch (err) {
      toast.error(exportT('export.download.pdfFailed'), { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  /** Downloads the library as an OKF v0.2 zip bundle (index, log, concept files). */
  const handleExportOkf = async () => {
    try {
      const [{ buildOkfBundle }, { zipSync, strToU8 }] = await Promise.all([
        import('@/lib/okf/bundle'),
        import('fflate'),
      ])
      const edges = graph?.edges ?? []
      const bundle = buildOkfBundle(entities, claims, edges, packageJson.version)
      const filesRecord: Record<string, Uint8Array> = {}
      for (const f of bundle.files) {
        filesRecord[`okf-bundle/${f.path}`] = strToU8(f.content)
      }
      const zipped = zipSync(filesRecord)
      downloadBlob(
        `do-knowledge-studio-okf-${stamp}.zip`,
        new Blob([zipped], { type: 'application/zip' }),
      )
      toast.success(exportT('export.download.okf'), {
        description: exportT('export.download.okfBody', String(bundle.files.length)),
      })
    } catch (err) {
      toast.error(exportT('export.download.okfFailed'), { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  /** Downloads a Word (.docx) document of all entities and claims. */
  const handleExportDocx = async () => {
    try {
      /** The DOCX builder. */
      const { buildDocxExport } = await import('./export-documents')
      const blob = await buildDocxExport(entities, claims)
      downloadBlob(`do-knowledge-studio-${stamp}.docx`, blob)
      toast.success(exportT('export.download.docx'), { description: exportT('export.download.docxBody', String(entities.length)) })
    } catch (err) {
      toast.error(exportT('export.download.docxFailed'), { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  /** Downloads a password-encrypted self-contained HTML reader. */
  const handleExportEncrypted = async () => {
    if (!password || password !== confirm) {
      toast.error(exportT('export.download.passwordMismatch'))
      return
    }
    try {
      const { encryptData, buildEncryptedReaderHtml } = await import('@/lib/export/encrypt')
      const json = buildJsonExport(entities, claims, exportOptions)
      const encrypted = await encryptData(json, password)
      /** The self-contained reader document. */
      const readerDocument = buildEncryptedReaderHtml(encrypted)
      // Downloaded as a file (Blob → anchor.click) and never injected into the DOM.
      downloadFile(`do-knowledge-studio-encrypted-${stamp}.html`, readerDocument, 'text/html')
      toast.success(exportT('export.download.encrypted'), { description: exportT('export.download.encryptedBody') })
    } catch (err) {
      toast.error(exportT('export.download.encryptedFailed'), { description: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setShowPassword(false)
      setPassword('')
      setConfirm('')
    }
  }

  /** Routes an export-format id to its download handler.
   *
   * Wraps every path in the busy state so the UI can disable the control that
   * started the export and mark the region `aria-busy` until the work settles.
   * The `finally` is what makes it honest: a failed PDF/DOCX/OKF build clears
   * the flag exactly like a successful one, so the grid can never be left
   * permanently disabled.
   */
  const handleExport = async (format: ExportFormatId) => {
    if (exportInFlightRef.current) return
    exportInFlightRef.current = true
    setExportingFormat(format)
    try {
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
          await handleExportPdf()
          break
        case 'docx':
          await handleExportDocx()
          break
        case 'encrypted':
          await handleExportEncrypted()
          break
        case 'okf':
          await handleExportOkf()
          break
        default:
          break
      }
    } finally {
      exportInFlightRef.current = false
      setExportingFormat(null)
    }
  }

  /** Opens the hidden file picker for import. */
  const handleImportClick = () => { fileInputRef.current?.click() }

  /**
   * Stages selected files for the import preview: `.zip` (OKF bundle or
   * vault) and `.md`/`.markdown` batches stage in `import-staging.ts`;
   * anything else falls through to the JSON backup path below.
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (selected.length === 0) return
    // Zip and Markdown picks stage asynchronously; the JSON backup path
    // below must stay synchronous (FileReader stub flows assert in-task).
    if (isNonJsonPick(selected)) {
      await stagePickedNonJsonFiles(selected, entities, setImportPreview)
      return
    }

    {
      // Non-empty: `selected.length === 0` returns above.
      const file = selected[0]
      const oversized = checkImportSize(file.size)
      if (oversized !== null) {
        toast.error(exportT('export.import.failed'), { description: oversized })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result || '')
        const result = parseImportFile(text)
        if (!result.success) {
          toast.error(exportT('export.import.failed'), { description: result.errors.map((err) => `${err.path}: ${err.message}`).join('; ') })
          return
        }
        const { entities: ents, claims: cls, version: fileVersion, graph: g, mindMap: m, links: l, tags: t } = result
        const existingIds = new Set(entities.map((ent) => ent.id))
        setImportPreview({
          entities: ents, claims: cls, graph: g, mindMap: m, links: l, tags: t,
          entityCount: ents.length,
          claimCount: cls.length, version: fileVersion,
          duplicateIds: ents.filter((ent) => existingIds.has(ent.id)).map((ent) => ent.id),
        })
      }
      reader.onerror = () => { toast.error(exportT('export.import.failed'), { description: exportT('export.import.unreadable') }) }
      reader.readAsText(file)
    }
  }

  /** Commits the staged import preview into the store with rollback on failure. */
  const handleConfirmImport = () => {
    if (!importPreview) return
    const result = importWithRollback(
      importPreview.entities,
      importPreview.claims,
      { graph: importPreview.graph, mindMap: importPreview.mindMap, links: importPreview.links, tags: importPreview.tags },
    )
    if (result.success) {
      // An import silently replaces the entire library, so the count is the
      // only way a screen reader user can confirm the scale of the change.
      announce(
        announceT(
          'announce.importSucceeded',
          String(importPreview.entityCount),
          importPreview.entityCount === 1 ? 'entity' : 'entities',
          String(importPreview.claimCount),
          importPreview.claimCount === 1 ? 'claim' : 'claims',
        ),
      )
      const summary = buildExportSummary({
        entities: importPreview.entities,
        claims: importPreview.claims,
        graph: importPreview.graph,
        mindMap: importPreview.mindMap,
        links: importPreview.links,
        tags: importPreview.tags,
      })
      // The import succeeded either way, but a missing backup changes what that
      // success means: there is no way back to the corpus that was replaced.
      // The same green toast in both cases would be a false claim.
      if (result.backupPersisted === false) {
        toast.warning(exportT('export.import.noBackupTitle'), {
          // A map keyed by the reason, not a ternary chain: the copy lives in the
          // message scope (#i18n rule) and an unknown reason falls back to the
          // storage refusal, which is what a refused write means.
          description: NO_BACKUP_COPY[result.backupFailure ?? 'storage-unavailable'],
        })
      } else {
        toast.success(exportT('export.import.successTitle'), {
          description: exportT('export.import.successBody', summary),
        })
      }
    } else {
      // The failed path is the one that must never be silent: the library
      // looked replaced for a moment before rolling back.
      announce(announceT('announce.importFailed'))
      toast.error(exportT('export.import.failedTitle'), { description: result.error })
    }
    setImportPreview(null)
  }

  /** Restores the store to the demo seed dataset. */
  const handleReset = () => {
    announce(announceT('announce.storeReset'))
    resetStore()
    toast.success(exportT('export.import.restoredDemo'), { description: exportT('export.import.restoredDemoBody') })
  }

  return {
    handleExport, exportingFormat, handleImportClick, handleFileChange, handleConfirmImport, handleReset,
    showPassword, setShowPassword, password, setPassword, confirm, setConfirm, showPass, setShowPass,
  }
}