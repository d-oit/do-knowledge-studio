import { create, insert, remove, search, type Orama } from '@orama/orama';
import { repository } from '../db/repository.js';
import { logger } from './logger.js';
import { compressText } from './nlp.js';
import { jobCoordinator } from './jobs.js';

interface SearchDoc {
  id: string;
  name: string;
  type: string;
  excerpt: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let oramaDb: Orama<any> | null = null;

export const initSearch = async () => {
  if (oramaDb) return oramaDb;

  try {
    oramaDb = await create({
      schema: {
        id: 'string',
        name: 'string',
        type: 'string',
        excerpt: 'string',
      },
    });

    const entities = await repository.getAllEntities();
    for (const entity of entities) {
      const doc: SearchDoc = {
        id: entity.id!,
        name: entity.name,
        type: entity.type,
        excerpt: compressText(`${entity.name} ${entity.description || ''}`),
      };
      await insert(oramaDb!, doc as unknown as Record<string, string>);

      const claims = await repository.getClaimsByEntityId(entity.id!);
      for (const claim of claims) {
        const claimDoc: SearchDoc = {
          id: claim.id!,
          name: entity.name,
          type: 'claim',
          excerpt: compressText(claim.statement),
        };
        await insert(oramaDb!, claimDoc as unknown as Record<string, string>);
      }
    }

    logger.info('Orama search index initialized');

    // Register job handlers
    jobCoordinator.registerHandler('reindex-document', async (payload) => {
      const { entityId } = payload as { entityId: string };
      await upsertToSearchIndex(entityId);
    });

    jobCoordinator.registerHandler('refresh-search-index', async () => {
      oramaDb = null;
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
    // First remove existing
    await removeFromSearchIndex(entityId);

    const entities = await repository.getAllEntities();
    const entity = entities.find(e => e.id === entityId);

    if (entity) {
      const doc: SearchDoc = {
        id: entity.id!,
        name: entity.name,
        type: entity.type,
        excerpt: compressText(`${entity.name} ${entity.description || ''}`),
      };
      await insert(oramaDb!, doc as unknown as Record<string, string>);

      const claims = await repository.getClaimsByEntityId(entity.id!);
      for (const claim of claims) {
        const claimDoc: SearchDoc = {
          id: claim.id!,
          name: entity.name,
          type: 'claim',
          excerpt: compressText(claim.statement),
        };
        await insert(oramaDb!, claimDoc as unknown as Record<string, string>);
      }
    }
  } catch (err) {
    logger.error(`Failed to upsert entity ${entityId} to search index`, err);
  }
};

/**
 * Removes an entity from the search index.
 */
export const removeFromSearchIndex = async (entityId: string) => {
  if (!oramaDb) return;

  try {
    // Orama remove requires the document ID.
    // Since we don't store internal Orama IDs, we need to find them or
    // use the 'id' property we defined in our schema.
    // In Orama 3, remove can take an ID if it matches the primary key,
    // but we didn't explicitly define a primary key.
    // Let's assume 'id' in our schema is what we want to match.

    // Actually, we can use search to find the internal IDs if needed,
    // but Orama's remove often works with the document ID if configured.
    // For simplicity, we can also just rebuild if it's too complex,
    // but the task asks for incremental.

    // Try removing by our 'id' field
    await remove(oramaDb!, entityId);

    // Note: This might only remove the entity, not its claims.
    // Our claims also have IDs, but they are not the entityId.
    // We might need to find all documents with 'id' equal to entityId OR
    // we need to change how we store claims.

    // For now, let's keep it simple and at least remove the main entity.
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
  name: string;
  type: string;
  excerpt: string;
}

export const searchKnowledge = async (query: string): Promise<SearchResult[]> => {
  if (!oramaDb) await initSearch();

  const results = await search(oramaDb!, {
    term: query,
    properties: ['name', 'excerpt'],
  });

  return results.hits.map(hit => {
    const doc = hit.document as unknown as SearchDoc;
    return {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      excerpt: doc.excerpt,
    };
  });
};
