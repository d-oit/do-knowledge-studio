/**
 * Builds the `Entity` a save writes from the editor's form state.
 *
 * Extracted from `editor-view.tsx` (which is at the repository's 500-line
 * ceiling) because it is pure: no hooks, no DOM, no store, so it can be reasoned
 * about and tested on its own.
 */
import { mergeMentionLinks } from '@/lib/editor/mention'
import type { AnyEntityType, Entity } from '@/lib/studio/types'

/** Editor form fields that become the saved entity. */
export interface EditorEntityInput {
  name: string
  type: AnyEntityType
  description: string
  content: string
  sourceUrl: string
  tags: string[]
}

/**
 * Builds the draft's Entity record from the current form state.
 * `entityId` is passed in (not generated here) so the saved id always matches
 * the id used to derive mention links and reciprocal backlinks — a locally
 * generated id would orphan every backlink written for a new entity.
 */
export const buildEditorEntity = (
  entityId: string,
  editing: Entity | null,
  input: EditorEntityInput,
  mentionLinks: { targetId: string; relation: string }[],
): Entity => {
  const fallbackDescription = input.content.slice(0, 200).replace(/[#*]/g, '').trim()
  return {
    id: entityId,
    name: input.name.trim(),
    type: input.type,
    description: input.description.trim() || fallbackDescription,
    content: input.content,
    sourceUrl: input.sourceUrl.trim() || undefined,
    tags: input.tags,
    createdAt: editing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: mergeMentionLinks(editing?.links ?? [], mentionLinks),
  }
}
