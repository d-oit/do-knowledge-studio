import { create, type Orama } from '@orama/orama';
import { logger } from '../logger';
import { AppError } from '../errors';

export const searchSchema = {
  id: 'string',
  type: 'string',
  title: 'string',
  content: 'string',
  keywords: 'string',
  embedding: 'vector[384]',
} as const;

export type OramaSchema = typeof searchSchema;

export let oramaDb: Orama<OramaSchema> | null = null;
export let embeddingsReady = false;
export let embeddingsPlugin: ReturnType<typeof import('@orama/plugin-embeddings')['pluginEmbeddings']> | null = null;
export const oramaIdMap = new Map<string, string>();
const ORAMA_MAP_MAX = 10000;

export function addToOramaMap(key: string, value: string): void {
  if (oramaIdMap.size >= ORAMA_MAP_MAX) {
    const firstKey = oramaIdMap.keys().next().value;
    if (firstKey !== undefined) oramaIdMap.delete(firstKey);
  }
  oramaIdMap.set(key, value);
}

export function clearOramaDb() {
  oramaDb = null;
  oramaIdMap.clear();
}

export const initEmbeddings = async (): Promise<boolean> => {
  if (embeddingsReady) return true;
  if (embeddingsPlugin) return false;

  try {
    const { pluginEmbeddings } = await import('@orama/plugin-embeddings');
    embeddingsPlugin = pluginEmbeddings({
      model: 'Xenova/all-MiniLM-L6-v2',
      property: 'embedding',
    });
    embeddingsReady = true;
    logger.info('Semantic embeddings plugin initialized');
    return true;
  } catch (err) {
    logger.error('Semantic embeddings initialization failed', err);
    embeddingsPlugin = null;
    throw new AppError('Failed to initialize embeddings', 'SEARCH_FAILED', err, 'Semantic search unavailable, falling back to keyword', true);
  }
};

export function createOramaIndex() {
  const plugins: unknown[] = [];
  if (embeddingsPlugin) {
    plugins.push(embeddingsPlugin);
  }

  oramaDb = create({
    schema: searchSchema,
    ...(plugins.length > 0 ? { plugins } : {}),
  }) as Orama<OramaSchema>;

  return oramaDb;
}
