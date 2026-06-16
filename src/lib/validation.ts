import { z } from 'zod';

/**
 * EntitySchema - Validates an entity record.
 *
 * Rules:
 * - name: 1-255 chars, trimmed, required
 * - type: 1-255 chars, trimmed, required (e.g. note, concept, person, project)
 * - description: optional, up to 10,000 chars
 * - sourceUrl: optional URL string, up to 2,048 chars
 * - metadata: optional record of arbitrary keys to unknown values
 */
export const EntitySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(255),
  type: z.string().trim().min(1, 'Type is required').max(255),
  description: z.string().trim().max(10000).optional(),
  sourceUrl: z.string().max(2048).optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * ClaimSchema - Validates a claim (a statement tied to an entity).
 *
 * Rules:
 * - entity_id: required UUID
 * - statement: 1-10,000 chars, trimmed, required
 * - confidence: 0-1, default 1
 * - verification_status: unverified | verified | disputed, default unverified
 */
export const ClaimSchema = z.object({
  id: z.string().uuid().optional(),
  entity_id: z.string().uuid(),
  statement: z.string().trim().min(1, 'Statement is required').max(10000),
  evidence: z.string().trim().max(10000).optional(),
  confidence: z.number().min(0).max(1).default(1),
  source: z.string().trim().max(10000).optional(),
  verification_status: z.enum(['unverified', 'verified', 'disputed']).default('unverified'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * NoteSchema - Validates a free-form note (optionally tied to an entity).
 *
 * Rules:
 * - entity_id: optional UUID; null detaches the note
 * - content: 1-100,000 chars, trimmed, required
 * - format: markdown | plain, default markdown
 */
export const NoteSchema = z.object({
  id: z.string().uuid().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  content: z.string().trim().min(1, 'Content is required').max(100000),
  format: z.enum(['markdown', 'plain']).default('markdown'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * LinkSchema - Validates a directed relation between two entities.
 *
 * Rules:
 * - source_id / target_id: required UUIDs
 * - relation: 1-255 chars, trimmed (e.g. references, supports, contradicts)
 */
export const LinkSchema = z.object({
  id: z.string().uuid().optional(),
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  relation: z.string().trim().min(1, 'Relation type is required').max(255),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * GraphSnapshotSchema - Validates a serialized knowledge graph snapshot.
 *
 * nodes_json and edges_json are JSON-encoded strings; parse and validate
 * against the graph-schemas Zod schemas (GraphNodeSchema, GraphEdgeSchema)
 * before persisting or rendering.
 */
export const GraphSnapshotSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(255),
  nodes_json: z.string(),
  edges_json: z.string(),
  description: z.string().trim().max(10000).optional(),
  created_at: z.string().optional(),
});

export type Entity = z.infer<typeof EntitySchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type GraphSnapshot = z.infer<typeof GraphSnapshotSchema>;
