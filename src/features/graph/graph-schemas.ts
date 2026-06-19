import { z } from 'zod';

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
});

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
});

export const GraphSnapshotDataSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphSnapshotData = z.infer<typeof GraphSnapshotDataSchema>;

export function validateSnapshotData(data: unknown): GraphSnapshotData | null {
  const result = GraphSnapshotDataSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return null;
}
