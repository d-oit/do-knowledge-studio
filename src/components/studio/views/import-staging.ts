import { toast } from 'sonner'
import type { Claim, Entity } from '@/lib/studio/types'
import type { ImportPreview } from './export-types'
import { isMarkdownExportFile, parseMarkdownExport } from '@/lib/import/markdown-export-parse'
import {
  isMarkdownPath,
  parseVaultFiles,
  type MarkdownImportResult,
} from '@/lib/import/markdown-import'
import { readVaultZip } from '@/lib/import/vault-zip'

/**
 * Import staging for archive and Markdown picks (issue #1054) — the
 * `.zip` / `.md` / `.markdown` branches of the export view's file picker.
 *
 * Split out of `use-export-handlers.ts` to keep that hook under the 500 LOC
 * file cap: this module owns parsing + preview staging, the hook keeps the
 * JSON branch, confirmation, and password-modal state.
 */

/** Maximum characters shown for joined import errors in toasts. */
const MAX_ERROR_CHARS = 240

/**
 * Joins non-fatal import errors into a toast-safe string, truncating long
 * lists at the last complete error that fits the budget so messages are not
 * silently cut mid-word.
 * @param errors - The collected import errors.
 * @returns A `; `-joined message capped at MAX_ERROR_CHARS characters.
 */
export const joinErrorMessages = (errors: string[]): string => {
  /** The fully joined message. */
  const joined = errors.join('; ')
  if (joined.length <= MAX_ERROR_CHARS) return joined
  /** The budgeted prefix. */
  const prefix = joined.slice(0, MAX_ERROR_CHARS)
  /** The cut position at the last complete error boundary. */
  const cut = prefix.lastIndexOf('; ')
  return `${cut > 0 ? prefix.slice(0, cut) : prefix}…`
}

/**
 * Stages a validated entity/claim payload for the import preview, computing
 * the duplicate-id overlap against the current library.
 */
export const stageImportPreview = (
  current: Entity[],
  staged: { entities: Entity[]; claims: Claim[] },
  setImportPreview: (preview: ImportPreview | null) => void,
  extra?: Pick<ImportPreview, 'stubNames' | 'conflicts'>,
): void => {
  /** The existing ids. */
  const existingIds = new Set(current.map((ent) => ent.id))
  setImportPreview({
    entities: staged.entities,
    claims: staged.claims,
    entityCount: staged.entities.length,
    claimCount: staged.claims.length,
    version: 1,
    duplicateIds: staged.entities.filter((ent) => existingIds.has(ent.id)).map((ent) => ent.id),
    ...extra,
  })
}

/** Stages a Markdown/vault result: toasts fail closed, previews carry stubs. */
export const stageMarkdownResult = (
  result: MarkdownImportResult,
  entities: Entity[],
  setImportPreview: (preview: ImportPreview | null) => void,
): void => {
  if (!result.success) {
    toast.error('Import failed', { description: result.error })
    return
  }
  if (result.warnings.length > 0) {
    // Partial success: stage the valid notes but surface the skipped ones.
    toast.warning('Partial import', { description: `${result.warnings.length} file(s) skipped — ${joinErrorMessages(result.warnings)}` })
  }
  stageImportPreview(entities, result, setImportPreview, {
    stubNames: result.stubNames,
    conflicts: result.conflicts,
  })
}

/**
 * Reads a `.zip` file and stages it for import preview: OKF bundles keep
 * their exact parser path (`.md` files only), anything else imports as an
 * Obsidian-style vault. Unreadable or hostile zips toast fail-closed.
 * @param file - The selected .zip file.
 * @param entities - Current library entities (for duplicate detection).
 * @param setImportPreview - Callback that stages the parsed preview.
 */
export const handleZipImport = async (
  file: File,
  entities: Entity[],
  setImportPreview: (preview: ImportPreview | null) => void,
): Promise<void> => {
  try {
    /** The vault files read through the streaming size-guarded reader. */
    const zipResult = await readVaultZip(await file.arrayBuffer())
    if (!zipResult.success) {
      toast.error('Import failed', { description: zipResult.error })
      return
    }
    /** The root index. */
    const rootIndex = zipResult.files.get('index.md') ?? ''
    if (rootIndex.includes('okf_version')) {
      /** The OKF-only files (the vault reader also keeps `.markdown`). */
      const okfFiles = new Map([...zipResult.files].filter(([path]) => path.endsWith('.md')))
      /** The OKF parser. */
      const { parseOkfBundle } = await import('@/lib/okf/import')
      const { entities: ents, claims: cls, errors } = parseOkfBundle(okfFiles)
      if (errors.length > 0 && ents.length === 0) {
        toast.error('Import failed', { description: joinErrorMessages(errors) })
        return
      }
      if (errors.length > 0) {
        // Partial success: stage the valid files but surface the skipped ones.
        toast.warning('Partial import', { description: `${errors.length} file(s) skipped — ${joinErrorMessages(errors)}` })
      }
      stageImportPreview(entities, { entities: ents, claims: cls }, setImportPreview)
      return
    }
    stageMarkdownResult(parseVaultFiles(zipResult.files), entities, setImportPreview)
  } catch (err) {
    toast.error('Import failed', { description: err instanceof Error ? err.message : 'Could not unzip the archive.' })
  }
}

/** The vault-relative path of a picked file (folder picks keep structure). */
const relativePathOf = (file: File): string =>
  (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name

/**
 * True when the pick holds a single `.zip` archive or at least one Markdown
 * note. Kept synchronous so the hook can route JSON picks to the legacy
 * FileReader branch without deferring them past the current task.
 */
export const isNonJsonPick = (selected: File[]): boolean => {
  if (selected.length === 1 && (selected[0]?.name.toLowerCase().endsWith('.zip') ?? false)) return true
  return selected.some((file) => isMarkdownPath(file.name))
}

/**
 * Stages `.zip` and Markdown picks for the import preview.
 * @param selected - Files from the picker (zip, notes, folder contents, or JSON).
 * @param entities - Current library entities (for duplicate detection).
 * @param setImportPreview - Callback that stages the parsed preview.
 * @returns True when the pick was a zip or Markdown batch (JSON falls through).
 */
export const stagePickedNonJsonFiles = async (
  selected: File[],
  entities: Entity[],
  setImportPreview: (preview: ImportPreview | null) => void,
): Promise<boolean> => {
  if (!isNonJsonPick(selected)) return false
  /** The zip file, when the pick is a single archive. */
  const zip = selected.length === 1 && (selected[0]?.name.toLowerCase().endsWith('.zip') ?? false)
    ? selected[0]
    : undefined
  if (zip) {
    await handleZipImport(zip, entities, setImportPreview)
    return true
  }

  /** The picked Markdown notes. */
  const markdownFiles = selected.filter((file) => isMarkdownPath(file.name))
  try {
    /** The path → content batch. */
    const batch = new Map<string, string>()
    for (const file of markdownFiles) {
      // A multi-file pick can hold two same-named notes from different
      // directories; a Map keyed by path would silently drop one. Suffix the
      // key instead — the same name on distinct ids surfaces as a conflict in
      // the preview, which is the designed UX for that case.
      const base = relativePathOf(file)
      let key = base
      let duplicate = 2
      while (batch.has(key)) {
        const dot = base.lastIndexOf('.')
        key = dot === -1 ? `${base} (${duplicate})` : `${base.slice(0, dot)} (${duplicate})${base.slice(dot)}`
        duplicate += 1
      }
      batch.set(key, await file.text())
    }
    // A lone export-shaped file round-trips through its own parser; a
    // lone vault note falls through to the batch path so its [[links]]
    // resolve by the same rules (unresolved → stubs).
    if (batch.size === 1) {
      /** The single picked note. */
      const onlyText = [...batch.values()][0] ?? ''
      if (isMarkdownExportFile(onlyText)) {
        stageMarkdownResult(parseMarkdownExport(onlyText), entities, setImportPreview)
        return true
      }
    }
    stageMarkdownResult(parseVaultFiles(batch), entities, setImportPreview)
  } catch (err) {
    toast.error('Import failed', { description: err instanceof Error ? err.message : 'Could not read the file.' })
  }
  return true
}
