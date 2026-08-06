import { EditorDraftSchema, type EditorDraft } from './draft-schema'

/** localStorage key prefix for draft records. */
const DRAFT_KEY_PREFIX = 'draft:'

/** Build the full localStorage key for a draft ID. */
function getDraftKey(id: string): string {
  return `${DRAFT_KEY_PREFIX}${id}`
}

/** Validate and persist an editor draft to localStorage. */
export function saveDraft(draft: EditorDraft): void {
  try {
    const parsed = EditorDraftSchema.parse(draft)
    localStorage.setItem(getDraftKey(parsed.id), JSON.stringify(parsed))
  } catch (error) {
    // Storage quota exceeded or validation failure — caller handles via error return
    console.error('Failed to save draft:', error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

/** Load and validate a draft from localStorage by ID. */
export function loadDraft(id: string): EditorDraft | null {
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
    console.error('Failed to load draft:', error instanceof Error ? error.message : error)
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

/** Load and return all valid drafts from localStorage. */
export function listAllDrafts(): EditorDraft[] {
  const drafts: EditorDraft[] = []
  for (const key of listDraftKeys()) {
    const draft = loadDraft(key)
    if (draft) drafts.push(draft)
  }
  return drafts
}