import { z } from 'zod'

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

export type EditorDraft = z.infer<typeof EditorDraftSchema>

export const CURRENT_DRAFT_VERSION = 1