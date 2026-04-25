import { z } from 'zod';

export const EntitySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  type: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const ClaimSchema = z.object({
  id: z.string().uuid().optional(),
  entity_id: z.string().uuid(),
  statement: z.string().min(1, 'Statement is required'),
  evidence: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1),
  source: z.string().optional(),
  verification_status: z.enum(['unverified', 'verified', 'disputed']).default('unverified'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const NoteSchema = z.object({
  id: z.string().uuid().optional(),
  entity_id: z.string().uuid().optional(),
  content: z.string().min(1, 'Content is required'),
  format: z.enum(['markdown', 'plain']).default('markdown'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const LinkSchema = z.object({
  id: z.string().uuid().optional(),
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  relation: z.string().min(1, 'Relation type is required'),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const GraphSnapshotSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  nodes_json: z.string(),
  edges_json: z.string(),
  description: z.string().optional(),
  created_at: z.string().datetime().optional(),
});

export type Entity = z.infer<typeof EntitySchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type GraphSnapshot = z.infer<typeof GraphSnapshotSchema>;
