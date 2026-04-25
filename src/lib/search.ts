import { create, insert, remove, search, type Orama } from '@orama/orama';
import { repository } from '../db/repository.js';
import { logger } from './logger.js';
import { compressText } from './nlp.js';
import { jobCoordinator } from './jobs.js';
import { aiService } from './ai.js';
import type { Entity, Claim } from '../lib/validation.js';

export interface RankedResult {
  id: string;
  name: string;
  type: string;
  excerpt: string;
  score: number;
  stage: 'fts' | 'vector' | 'hybrid';
}

interface SearchDocument {
  id: string;
  type: 'entity' | 'claim';
  title: string;
  content: string;
  keywords: string;
  embedding: number[];
}

type OramaSchema = typeof searchSchema;
const searchSchema = {
  id: 'string',
  type: 'string',
  title: 'string',
  content: 'string',
  keywords: 'string',
  embedding: 'vector[1536]',
} as const;

let oramaDb: Orama<OramaSchema> | null = null;
const oramaIdMap = new Map<string, string>(); // entityId → oramaInternalId

const addEntityToIndex = async (entity: Entity, claims: Claim[]): Promise<void> => {
  if (!oramaDb) return;

  const entityContent = `${entity.name} ${entity.description || ''}`;
  let entityEmbedding = entity.embedding;
  if (!entityEmbedding) {
    entityEmbedding = await aiService.generateEmbedding(entityContent);
    // Note: In a full app, we would update the entity in the DB with the embedding here.
  }

  const entityDoc: SearchDocument = {
    id: entity.id!,
    type: 'entity',
    title: entity.name,
    content: compressText(entityContent),
    keywords: entity.type,
    embedding: entityEmbedding,
  };

  const entityResult = await insert(oramaDb, entityDoc);
  oramaIdMap.set(entity.id!, entityResult);

  for (const claim of claims) {
    let claimEmbedding = claim.embedding;
    if (!claimEmbedding) {
        claimEmbedding = await aiService.generateEmbedding(claim.statement);
    }
    const claimDoc: SearchDocument = {
      id: claim.id!,
      type: 'claim',
      title: entity.name,
      content: compressText(claim.statement),
      keywords: [entity.id!, claim.source || 'unknown'].join(','),
      embedding: claimEmbedding,
    };
    const claimResult = await insert(oramaDb, claimDoc);
    oramaIdMap.set(claim.id!, claimResult);
  }
};

export const initSearch = async () => {
  if (oramaDb) return oramaDb;

  try {
    oramaDb = await create({
      schema: searchSchema,
    });

    const entities = await repository.getAllEntities();
    for (const entity of entities) {
      const claims = await repository.getClaimsByEntityId(entity.id!);
      await addEntityToIndex(entity, claims);
    }

    logger.info('Orama search index initialized');

    // Register job handlers
    jobCoordinator.registerHandler('reindex-document', async (payload) => {
      const { entityId } = payload as { entityId: string };
      await upsertToSearchIndex(entityId);
    });

    jobCoordinator.registerHandler('refresh-search-index', async () => {
      oramaDb = null;
      oramaIdMap.clear();
      await initSearch();
    });

    return oramaDb;
  } catch (err) {
    logger.error('Failed to initialize search index', err);
    throw err;
  }
};

/**
 * Upserts an entity and its claims to the search index.
 */
export const upsertToSearchIndex = async (entityId: string) => {
  if (!oramaDb) await initSearch();

  try {
    await removeFromSearchIndex(entityId);

    const entities = await repository.getAllEntities();
    const entity = entities.find(e => e.id === entityId);

    if (entity) {
      const claims = await repository.getClaimsByEntityId(entity.id!);
      await addEntityToIndex(entity, claims);
    }
  } catch (err) {
    logger.error(`Failed to upsert entity ${entityId} to search index`, err);
  }
};

/**
 * Removes an entity and its claims from the search index.
 */
export const removeFromSearchIndex = async (entityId: string) => {
  if (!oramaDb) return;

  try {
    const oramaInternalId = oramaIdMap.get(entityId);
    if (oramaInternalId) {
      await remove(oramaDb, oramaInternalId);
      oramaIdMap.delete(entityId);
    }

    const claims = await repository.getClaimsByEntityId(entityId);
    for (const claim of claims) {
      const claimOramaId = oramaIdMap.get(claim.id!);
      if (claimOramaId) {
        await remove(oramaDb, claimOramaId);
        oramaIdMap.delete(claim.id!);
      }
    }
  } catch (err) {
    logger.error(`Failed to remove entity ${entityId} from search index`, err);
  }
};

/**
 * Hydrates the search index when idle or requested.
 */
export const hydrateOramaIndex = () => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
      initSearch().catch(err => logger.error('Deferred Orama hydration failed', err));
    });
  } else {
    setTimeout(() => {
      initSearch().catch(err => logger.error('Fallback Orama hydration failed', err));
    }, 1000);
  }
};

export const searchKnowledge = async (query: string): Promise<RankedResult[]> => {
  if (!oramaDb) await initSearch();

  const queryEmbedding = await aiService.generateEmbedding(query);

  const results = await search(oramaDb!, {
    term: query,
    properties: ['title', 'content'],
    mode: 'hybrid',
    vector: {
      value: queryEmbedding,
      property: 'embedding',
    },
  });

  return results.hits.map(hit => {
    const doc = hit.document;
    return {
      id: doc.id,
      name: doc.title,
      type: doc.type,
      excerpt: doc.content,
      score: hit.score,
      stage: 'hybrid',
    };
  });
};
