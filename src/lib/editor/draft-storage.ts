import { EditorDraftSchema, type EditorDraft } from './draft-schema'

const DRAFT_KEY_PREFIX = 'draft:'

function getDraftKey(id: string): string {
  return `${DRAFT_KEY_PREFIX}${id}`
}

export function saveDraft(draft: EditorDraft): void {
  try {
    const parsed = EditorDraftSchema.parse(draft)
    localStorage.setItem(getDraftKey(parsed.id), JSON.stringify(parsed))
  } catch {
    // Storage quota or validation — caller handles via error return
  }
}

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
  } catch {
    removeDraft(id)
    return null
  }
}

export function removeDraft(id: string): void {
  localStorage.removeItem(getDraftKey(id))
}

export function generateDraftId(): string {
  return crypto.randomUUID()
}

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

export function listAllDrafts(): EditorDraft[] {
  const drafts: EditorDraft[] = []
  for (const key of listDraftKeys()) {
    const draft = loadDraft(key)
    if (draft) drafts.push(draft)
  }
  return drafts
}