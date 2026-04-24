import { create, insert, remove, search, type Orama } from '@orama/orama';
import { repository } from '../db/repository.js';
import { logger } from './logger.js';
import { compressText } from './nlp.js';
import { jobCoordinator } from './jobs.js';
import type { Entity, Claim } from '../lib/validation.js';

interface SearchDocument {
  id: string;
  type: 'entity' | 'claim';
  title: string;
  content: string;
  keywords: string;
}

// Use Orama<any> due to complex Orama 3 type system - proper typing requires schema literal types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let oramaDb: Orama<any> | null = null;
const oramaIdMap = new Map<string, string>(); // entityId → oramaInternalId

const addEntityToIndex = async (entity: Entity, claims: Claim[]): Promise<void> => {
  if (!oramaDb) return;

  const entityDoc: SearchDocument = {
    id: entity.id!,
    type: 'entity',
    title: entity.name,
    content: compressText(`${entity.name} ${entity.description || ''}`),
    keywords: entity.type,
  };

  const entityResult = await insert(oramaDb, entityDoc as unknown as Record<string, string>);
  oramaIdMap.set(entity.id!, entityResult);

  for (const claim of claims) {
    const claimDoc: SearchDocument = {
      id: claim.id!,
      type: 'claim',
      title: entity.name,
      content: compressText(claim.statement),
      keywords: [entity.id!, claim.source || 'unknown'].join(','),
    };
    const claimResult = await insert(oramaDb, claimDoc as unknown as Record<string, string>);
    oramaIdMap.set(claim.id!, claimResult);
  }
};

export const initSearch = async () => {
  if (oramaDb) return oramaDb;

  try {
    oramaDb = await create({
      schema: {
        id: 'string',
        type: 'string',
        title: 'string',
        content: 'string',
        keywords: 'string',
      },
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

export interface SearchResult {
  id: string;
  title: string;
  type: string;
  content: string;
}

export const searchKnowledge = async (query: string): Promise<SearchResult[]> => {
  if (!oramaDb) await initSearch();

  const results = await search(oramaDb!, {
    term: query,
    properties: ['title', 'content'],
  });

  return results.hits.map(hit => {
    const doc = hit.document as unknown as SearchResult;
    return {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      content: doc.content,
    };
  });
};
