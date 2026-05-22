import { z } from 'zod';

export const EntitySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(255),
  type: z.string().trim().min(1, 'Type is required').max(255),
  description: z.string().trim().max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

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

export const NoteSchema = z.object({
  id: z.string().uuid().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  content: z.string().trim().min(1, 'Content is required').max(100000),
  format: z.enum(['markdown', 'plain']).default('markdown'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const LinkSchema = z.object({
  id: z.string().uuid().optional(),
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  relation: z.string().trim().min(1, 'Relation type is required').max(255),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

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
