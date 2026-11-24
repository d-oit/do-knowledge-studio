import { EditorDraftSchema, type EditorDraft } from './draft-schema'
import { isAtRestEncryptionEnabled } from '@/lib/studio/at-rest-session'
import { logger } from '@/lib/logging/logger'

/** Subsystem tag for editor-draft storage logs. */
const log = logger.child({ area: 'editor' })

/** localStorage key prefix for draft records. */
const DRAFT_KEY_PREFIX = 'draft:'

/** Build the full localStorage key for a draft ID. */
function getDraftKey(id: string): string {
  return `${DRAFT_KEY_PREFIX}${id}`
}

/**
 * Validate and persist an editor draft to localStorage.
 *
 * Drafts are a synchronous localStorage surface holding raw entity text, so
 * while the workspace is encrypted they are not written at all (ADR 048 §5).
 * The in-editor draft still works; only crash recovery across a reload is
 * unavailable, which the settings copy states.
 */
export function saveDraft(draft: EditorDraft): void {
  if (isAtRestEncryptionEnabled()) {
    log.warn('Editor drafts are not persisted while the workspace is encrypted')
    return
  }
  try {
    const parsed = EditorDraftSchema.parse(draft)
    localStorage.setItem(getDraftKey(parsed.id), JSON.stringify(parsed))
  } catch (error) {
    // Storage quota exceeded or validation failure — caller handles via error return
    log.error('Failed to save draft', { error })
    throw error
  }
}

/** Load and validate a draft from localStorage by ID. */
export function loadDraft(id: string): EditorDraft | null {
  // Sealed workspace: a draft left from before encryption is plaintext corpus
  // text and must not be offered back.
  if (isAtRestEncryptionEnabled()) return null
  try {
    const raw = localStorage.getItem(getDraftKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const result = EditorDraftSchema.safeParse(parsed)
    if (!result.success) {
      removeDraft(id)
      return null
    }
    return result.data
  } catch (error) {
    log.error('Failed to load draft', { error })
    removeDraft(id)
    return null
  }
}

/** Remove a draft from localStorage by ID. */
export function removeDraft(id: string): void {
  localStorage.removeItem(getDraftKey(id))
}

/** Generate a new UUID for a draft ID. */
export function generateDraftId(): string {
  return crypto.randomUUID()
}

/** Return all draft IDs stored in localStorage. */
export function listDraftKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(DRAFT_KEY_PREFIX)) {
      keys.push(key.slice(DRAFT_KEY_PREFIX.length))
    }
  }
  return keys
}

/**
 * Removes every stored draft, returning how many keys were removed.
 *
 * Called by the enable-encryption migration: a plaintext draft is a readable
 * copy of note text that the encrypted corpus is supposed to replace.
 */
export function clearAllDrafts(): number {
  const keys = listDraftKeys()
  for (const key of keys) removeDraft(key)
  return keys.length
}

/** Load and return all valid drafts from localStorage. */
export function listAllDrafts(): EditorDraft[] {
  const drafts: EditorDraft[] = []
  for (const key of listDraftKeys()) {
    const draft = loadDraft(key)
    if (draft) drafts.push(draft)
  }
  return drafts
}