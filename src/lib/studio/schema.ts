import { z } from 'zod'

/** Zod enum schema for EntityType. */
export const EntityTypeSchema = z.enum(['note', 'concept', 'person', 'project'])

/** Zod enum schema for VerificationStatus. */
export const VerificationStatusSchema = z.enum(['unverified', 'verified', 'disputed'])

/** Zod object schema validating an Entity record. */
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

/** Zod object schema validating a Claim record. */
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

/** Zod schema validating a node in the knowledge graph export. */
export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: EntityTypeSchema,
  x: z.number(),
  y: z.number(),
})

/** Zod schema validating an edge in the knowledge graph export. */
export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string(),
  target: z.string(),
  relation: z.string(),
})

/** Zod schema validating the full knowledge graph export payload. */
export const GraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
})

/** Zod schema validating a node in the mind map export. */
export const MindMapNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: EntityTypeSchema,
  x: z.number().optional(),
  y: z.number().optional(),
})

/** Zod schema validating an edge in the mind map export. */
export const MindMapEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string(),
  target: z.string(),
  relation: z.string(),
})

/** Zod schema validating the full mind map export payload. */
export const MindMapSchema = z.object({
  nodes: z.array(MindMapNodeSchema),
  edges: z.array(MindMapEdgeSchema),
})

/** Zod schema validating a link between two entities in an export. */
export const LinkSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
  createdAt: z.string(),
})

/** Zod schema validating a tag in an export payload. */
export const TagSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().optional(),
})

/** Zod schema validating the full JSON export payload (ADR 010 v1). */
export const ExportPayloadSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
  graph: GraphSchema.optional(),
  mindMap: MindMapSchema.optional(),
  links: z.array(LinkSchema).optional(),
  tags: z.array(TagSchema).optional(),
})

/** Zod schema validating the localStorage persistence envelope. */
export const PersistedEnvelopeSchema = z.object({
  version: z.number().int().positive(),
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
  graph: GraphSchema.optional(),
  mindMap: MindMapSchema.optional(),
  links: z.array(LinkSchema).optional(),
  tags: z.array(TagSchema).optional(),
})

/** Type of a validated entity record. */
export type ValidatedEntity = z.infer<typeof EntitySchema>
/** Type of a validated claim record. */
export type ValidatedClaim = z.infer<typeof ClaimSchema>
/** Type of a validated graph node. */
export type ValidatedGraphNode = z.infer<typeof GraphNodeSchema>
/** Type of a validated graph edge. */
export type ValidatedGraphEdge = z.infer<typeof GraphEdgeSchema>
/** Type of a validated knowledge graph payload. */
export type ValidatedGraph = z.infer<typeof GraphSchema>
/** Type of a validated mind map node. */
export type ValidatedMindMapNode = z.infer<typeof MindMapNodeSchema>
/** Type of a validated mind map edge. */
export type ValidatedMindMapEdge = z.infer<typeof MindMapEdgeSchema>
/** Type of a validated mind map payload. */
export type ValidatedMindMap = z.infer<typeof MindMapSchema>
/** Type of a validated link between entities. */
export type ValidatedLink = z.infer<typeof LinkSchema>
/** Type of a validated tag record. */
export type ValidatedTag = z.infer<typeof TagSchema>
/** Type of a validated JSON export payload. */
export type ValidatedExportPayload = z.infer<typeof ExportPayloadSchema>
/** Type of a validated localStorage persistence envelope. */
export type ValidatedPersistedEnvelope = z.infer<typeof PersistedEnvelopeSchema>

/** Describes a single validation failure with the offending data path. */
export interface ValidationError {
  path: string
  message: string
}

/** Validate unknown data against the persisted envelope schema. */
export const validatePersistedState = (
  data: unknown,
): { success: true; data: ValidatedPersistedEnvelope } | { success: false; errors: ValidationError[] } => {
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

/** Validate unknown data against the export payload schema. */
export const validateImportPayload = (
  data: unknown,
): { success: true; data: ValidatedExportPayload } | { success: false; errors: ValidationError[] } => {
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
