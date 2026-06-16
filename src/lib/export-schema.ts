/**
 * Knowledge Studio Export Schema v1.0
 *
 * Canonical export/import shape for the full studio state.
 * Versioned to allow future evolution (v1.1, v2.0, ...) without breaking
 * existing exports. See ADR-010.
 */
import { z } from 'zod';
import {
  ClaimSchema,
  EntitySchema,
  LinkSchema,
  NoteSchema,
} from './validation';
import { GraphEdgeSchema, GraphNodeSchema } from '../features/graph/graph-schemas';

export const ExportSourceSchema = z.enum(['browser', 'cli', 'api']);
export type ExportSource = z.infer<typeof ExportSourceSchema>;

export const GraphSectionSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});
export type GraphSection = z.infer<typeof GraphSectionSchema>;

type MindMapNodeShape = {
  id: string;
  topic: string;
  children?: MindMapNodeShape[];
  [key: string]: unknown;
};

const MindMapNodeDataSchema: z.ZodType<MindMapNodeShape> = z
  .object({
    id: z.string(),
    topic: z.string(),
    children: z.lazy(() => z.array(MindMapNodeDataSchema)).optional(),
  })
  .passthrough();
export type MindMapNodeData = MindMapNodeShape;

export const MindMapDataSchema = z
  .object({
    nodeData: MindMapNodeDataSchema,
  })
  .passthrough()
  .nullable();
export type MindMapData = z.infer<typeof MindMapDataSchema>;

export const ExportMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  source: ExportSourceSchema.default('browser'),
});
export type ExportMetadata = z.infer<typeof ExportMetadataSchema>;

export const ExportSchemaV1 = z.object({
  version: z.literal('1.0'),
  exportedAt: z.string().datetime({ offset: true }),
  metadata: ExportMetadataSchema,
  notes: z.array(NoteSchema),
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
  links: z.array(LinkSchema),
  graph: GraphSectionSchema,
  mindMap: MindMapDataSchema,
  tags: z.array(z.string()),
});

export type KnowledgeStudioExport = z.infer<typeof ExportSchemaV1>;

/** Current/active schema version string. */
export const CURRENT_EXPORT_VERSION = '1.0' as const;

export interface ImportResult {
  export: KnowledgeStudioExport;
  warnings: string[];
}

export class UnsupportedExportVersionError extends Error {
  constructor(public readonly foundVersion: string) {
    super(
      `Unsupported export version: "${foundVersion}". Expected "${CURRENT_EXPORT_VERSION}".`,
    );
    this.name = 'UnsupportedExportVersionError';
  }
}

/**
 * Parse a JSON string into a validated KnowledgeStudioExport. Throws
 * UnsupportedExportVersionError if the version field is missing or unknown,
 * and a ZodError-derived Error for any other validation failure.
 */
export function importExportJson(json: string): ImportResult {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new UnsupportedExportVersionError('(missing)');
  }
  const version: unknown = parsed.version;
  if (version !== CURRENT_EXPORT_VERSION) {
    throw new UnsupportedExportVersionError(String(version));
  }
  const result = ExportSchemaV1.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Export validation failed: ${detail}`);
  }
  return { export: result.data, warnings: [] };
}

/** Stringify a KnowledgeStudioExport with the current version stamp. */
export function exportToJsonString(
  data: Omit<KnowledgeStudioExport, 'version' | 'exportedAt'>,
): string {
  const payload: KnowledgeStudioExport = {
    version: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    ...data,
  };
  return JSON.stringify(payload, null, 2);
}
