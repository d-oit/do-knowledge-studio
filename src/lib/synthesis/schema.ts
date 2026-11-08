/**
 * Validation for model output and for persisted proposals (#1057).
 *
 * Two layers, deliberately separate:
 *
 * - {@link RawExtractionSchema} validates the model's JSON shape and repairs
 *   the parts that are safe to repair (an unknown entity type becomes a
 *   concept, a confidence outside 0..1 is clamped).
 * - {@link SynthesisProposalSchema} validates what is stored for review, so a
 *   hand-edited or migrated envelope cannot introduce a proposal the inbox
 *   would not render.
 */
import { z } from 'zod'

/**
 * Entity type accepted on a proposal. Declared here rather than imported from
 * `studio/schema` on purpose: that module imports this one for the envelope
 * schema, and a shared import would close a cycle.
 */
const BuiltInEntityTypeSchema = z.enum(['note', 'concept', 'person', 'project'])
/** Plugin-registered type ids, bounded the same way the studio schema bounds them. */
const CustomProposalEntityTypeSchema = z.string().min(1).max(64)

/** Longest note excerpt sent to a provider; longer notes are trimmed. */
export const MAX_EXTRACTION_INPUT_CHARS = 12_000
/** Most entities one extraction may propose. */
export const MAX_PROPOSED_ENTITIES = 12
/** Most claims one extraction may propose. */
export const MAX_PROPOSED_CLAIMS = 24
/** Longest proposed name, statement or description. */
export const MAX_PROPOSAL_TEXT_CHARS = 400
/** Longest quoted evidence span kept with a proposal. */
export const MAX_EVIDENCE_CHARS = 400
/** Largest raw model response accepted for parsing. */
export const MAX_EXTRACTION_RESPONSE_CHARS = 64_000
/** Longest `ai:<model>` provenance string written to a claim. */
export const MAX_PROVENANCE_CHARS = 120
/** Default confidence when the model does not report one. */
export const DEFAULT_EXTRACTION_CONFIDENCE = 0.5

/** Entity type a proposal falls back to when the model names an unknown one. */
export const FALLBACK_ENTITY_TYPE = 'concept' as const

/** Provider-agnostic entity draft; every field is read leniently. */
const RawEntitySchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
  evidence: z.string().optional(),
})

/** Provider-agnostic claim draft; every field is read leniently. */
const RawClaimSchema = z.object({
  statement: z.string(),
  entity: z.string().optional(),
  confidence: z.number().optional(),
  evidence: z.string().optional(),
})

/** The JSON object a provider is asked to return. */
export const RawExtractionSchema = z.object({
  entities: z.array(RawEntitySchema).default([]),
  claims: z.array(RawClaimSchema).default([]),
})

/** A stored entity proposal. */
export const EntityProposalSchema = z.object({
  kind: z.literal('entity'),
  id: z.string().min(1),
  noteId: z.string().min(1),
  noteName: z.string(),
  name: z.string().min(1).max(MAX_PROPOSAL_TEXT_CHARS),
  entityType: z.union([BuiltInEntityTypeSchema, CustomProposalEntityTypeSchema]),
  description: z.string().max(MAX_PROPOSAL_TEXT_CHARS),
  evidence: z.string().max(MAX_EVIDENCE_CHARS),
  confidence: z.number().min(0).max(1),
  model: z.string().min(1).max(MAX_PROVENANCE_CHARS),
  provider: z.string().min(1),
  createdAt: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected']),
  duplicateOf: z.string().nullable(),
})

/** A stored claim proposal. */
export const ClaimProposalSchema = z.object({
  kind: z.literal('claim'),
  id: z.string().min(1),
  noteId: z.string().min(1),
  noteName: z.string(),
  statement: z.string().min(1).max(MAX_PROPOSAL_TEXT_CHARS),
  entityName: z.string().max(MAX_PROPOSAL_TEXT_CHARS).nullable(),
  evidence: z.string().max(MAX_EVIDENCE_CHARS),
  confidence: z.number().min(0).max(1),
  model: z.string().min(1).max(MAX_PROVENANCE_CHARS),
  provider: z.string().min(1),
  createdAt: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected']),
  duplicateOf: z.string().nullable(),
})

/** A stored proposal of either kind. */
export const SynthesisProposalSchema = z.discriminatedUnion('kind', [
  EntityProposalSchema,
  ClaimProposalSchema,
])

/** Type of a validated entity proposal. */
export type ValidatedEntityProposal = z.infer<typeof EntityProposalSchema>
/** Type of a validated claim proposal. */
export type ValidatedClaimProposal = z.infer<typeof ClaimProposalSchema>
