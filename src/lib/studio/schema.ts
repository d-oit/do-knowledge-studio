import { z } from 'zod'

export const EntityTypeSchema = z.enum(['note', 'concept', 'person', 'project'])

export const VerificationStatusSchema = z.enum(['unverified', 'verified', 'disputed'])

export const EntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: EntityTypeSchema,
  description: z.string(),
  content: z.string(),
  sourceUrl: z.string().url().optional(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  links: z.array(
    z.object({
      targetId: z.string(),
      relation: z.string(),
    }),
  ),
})

export const ClaimSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  statement: z.string().min(1),
  evidence: z.string().optional(),
  confidence: z.number().min(0).max(1),
  verification: VerificationStatusSchema,
  source: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  version: z.number().int().min(1).default(1),
  editHistory: z.array(z.object({
    statement: z.string(),
    editedAt: z.string(),
  })).default([]),
})

export const ExportPayloadSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
})

export const PersistedEnvelopeSchema = z.object({
  version: z.number().int().positive(),
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
})

export type ValidatedEntity = z.infer<typeof EntitySchema>
export type ValidatedClaim = z.infer<typeof ClaimSchema>
export type ValidatedExportPayload = z.infer<typeof ExportPayloadSchema>
export type ValidatedPersistedEnvelope = z.infer<typeof PersistedEnvelopeSchema>

export interface ValidationError {
  path: string
  message: string
}

export function validatePersistedState(
  data: unknown,
): { success: true; data: ValidatedPersistedEnvelope } | { success: false; errors: ValidationError[] } {
  const result = PersistedEnvelopeSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  }
}

export function validateImportPayload(
  data: unknown,
): { success: true; data: ValidatedExportPayload } | { success: false; errors: ValidationError[] } {
  const result = ExportPayloadSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  }
}
