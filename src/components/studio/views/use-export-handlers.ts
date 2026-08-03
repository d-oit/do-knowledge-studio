import { useState } from 'react'
import { toast } from 'sonner'
import type { Entity, Claim } from '@/lib/studio/types'
import type { ImportPreview, ExportFormatId } from './export-helpers'
import {
  todayStamp, downloadFile, downloadBlob,
  buildJsonExport, buildMarkdownExport, buildHtmlExport,
  buildPdfExport, buildDocxExport, parseImportFile,
} from './export-helpers'
import { encryptData, buildEncryptedReaderHtml } from '@/lib/export/encrypt'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from '@/lib/studio/schema'

interface ImportRollbackResult {
  success: boolean
  error?: string
}

interface UseExportHandlersParams {
  entities: Entity[]
  claims: Claim[]
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
  importWithRollback: (entities: Entity[], claims: Claim[], graph?: ValidatedGraph, mindMap?: ValidatedMindMap, links?: ValidatedLink[], tags?: ValidatedTag[]) => ImportRollbackResult
  resetStore: () => void
  importPreview: ImportPreview | null
  setImportPreview: (preview: ImportPreview | null) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export interface UseExportHandlersReturn {
  handleExport: (format: ExportFormatId) => Promise<void>
  handleImportClick: () => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleConfirmImport: () => void
  handleReset: () => void
  showPassword: boolean
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
  password: string
  setPassword: React.Dispatch<React.SetStateAction<string>>
  confirm: string
  setConfirm: React.Dispatch<React.SetStateAction<string>>
  showPass: boolean
  setShowPass: React.Dispatch<React.SetStateAction<boolean>>
}

export function useExportHandlers({
  entities, claims, graph, mindMap, links, tags, importWithRollback, resetStore,
  importPreview, setImportPreview, fileInputRef,
}: UseExportHandlersParams): UseExportHandlersReturn {
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleExport = async (format: ExportFormatId) => {
    if (format === 'json') {
      const content = buildJsonExport(entities, claims, graph, mindMap, links, tags)
      downloadFile(`do-knowledge-studio-export-${todayStamp()}.json`, content, 'application/json')
      const parts = [`${entities.length} entities`, `${claims.length} claims`]
      if (graph?.nodes?.length) parts.push(`${graph.nodes.length} graph nodes`)
      if (mindMap?.nodes?.length) parts.push(`${mindMap.nodes.length} mind map nodes`)
      if (links?.length) parts.push(`${links.length} links`)
      if (tags?.length) parts.push(`${tags.length} tags`)
      toast.success('JSON export downloaded', { description: parts.join(' · ') })
      return
    }
    if (format === 'markdown') {
      const content = buildMarkdownExport(entities, claims)
      downloadFile(`do-knowledge-studio-${todayStamp()}.md`, content, 'text/markdown')
      toast.success('Markdown export downloaded', { description: `${entities.length} entities concatenated into one .md file` })
      return
    }
    if (format === 'html') {
      const content = buildHtmlExport(entities, claims)
      downloadFile(`do-knowledge-studio-${todayStamp()}.html`, content, 'text/html')
      toast.success('HTML export downloaded', { description: 'Self-contained .html page — open in any browser.' })
      return
    }
    if (format === 'pdf') {
      try {
        const blob = buildPdfExport(entities, claims)
        downloadBlob(`do-knowledge-studio-${todayStamp()}.pdf`, blob)
        toast.success('PDF export downloaded', { description: `${entities.length} entities formatted in a print-ready PDF.` })
      } catch (err) {
        toast.error('PDF export failed', { description: err instanceof Error ? err.message : 'Unknown error' })
      }
      return
    }
    if (format === 'docx') {
      try {
        const blob = await buildDocxExport(entities, claims)
        downloadBlob(`do-knowledge-studio-${todayStamp()}.docx`, blob)
        toast.success('DOCX export downloaded', { description: `${entities.length} entities in a Word document.` })
      } catch (err) {
        toast.error('DOCX export failed', { description: err instanceof Error ? err.message : 'Unknown error' })
      }
      return
    }
    if (format === 'encrypted') {
      if (!password || password !== confirm) {
        toast.error('Password fields must match and not be empty.')
        return
      }
      try {
        const json = buildJsonExport(entities, claims, graph, mindMap, links, tags)
        const encrypted = await encryptData(json, password)
        const html = buildEncryptedReaderHtml(encrypted)
        downloadFile(`do-knowledge-studio-encrypted-${todayStamp()}.html`, html, 'text/html')
        toast.success('Encrypted export downloaded', { description: 'AES-256-GCM encrypted with PBKDF2 key derivation.' })
      } catch (err) {
        toast.error('Encrypted export failed', { description: err instanceof Error ? err.message : 'Unknown error' })
      } finally {
        setShowPassword(false)
        setPassword('')
        setConfirm('')
      }
    }
  }

  const handleImportClick = () => { fileInputRef.current?.click() }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const result = parseImportFile(text)
      if (!result.success) {
        toast.error('Import failed', { description: result.errors.map((err) => `${err.path}: ${err.message}`).join('; ') })
        return
      }
      const { entities: ents, claims: cls, graph: g, mindMap: m, links: l, tags: t } = result
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

  const handleConfirmImport = () => {
    if (!importPreview) return
    const result = importWithRollback(
      importPreview.entities,
      importPreview.claims,
      importPreview.graph,
      importPreview.mindMap,
      importPreview.links,
      importPreview.tags,
    )
    if (result.success) {
      const parts = [`${importPreview.entityCount} entities`, `${importPreview.claimCount} claims`]
      if (importPreview.graph?.nodes?.length) parts.push(`${importPreview.graph.nodes.length} graph nodes`)
      if (importPreview.mindMap?.nodes?.length) parts.push(`${importPreview.mindMap.nodes.length} mind map nodes`)
      if (importPreview.links?.length) parts.push(`${importPreview.links.length} links`)
      if (importPreview.tags?.length) parts.push(`${importPreview.tags.length} tags`)
      toast.success('Import complete', {
        description: `${parts.join(' · ')} replaced the current library.`,
      })
    } else {
      toast.error('Import failed — state restored', { description: result.error })
    }
    setImportPreview(null)
  }

  const handleReset = () => {
    resetStore()
    toast.success('Restored to demo data', { description: 'All entities and claims have been reset to the seed dataset.' })
  }

  return {
    handleExport, handleImportClick, handleFileChange, handleConfirmImport, handleReset,
    showPassword, setShowPassword, password, setPassword, confirm, setConfirm, showPass, setShowPass,
  }
}
