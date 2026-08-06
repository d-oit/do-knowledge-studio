import { z } from 'zod'

/** Zod schema validating an editor draft record. */
export const EditorDraftSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().nullable(),
  name: z.string(),
  content: z.string(),
  description: z.string(),
  type: z.string(),
  sourceUrl: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(1),
})

/** Type inferred from the EditorDraft schema. */
export type EditorDraft = z.infer<typeof EditorDraftSchema>

/** Current draft schema version for forward-compatible migrations. */
export const CURRENT_DRAFT_VERSION = 1