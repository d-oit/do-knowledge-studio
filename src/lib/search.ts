import { create, insert, insertMultiple, remove, search, type Orama } from '@orama/orama';
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

const searchSchema = {
  id: 'string',
  type: 'string',
  title: 'string',
  content: 'string',
  keywords: 'string',
} as const;
export type OramaSchema = typeof searchSchema;

let oramaDb: Orama<OramaSchema> | null = null;
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

  const entityResult = await insert(oramaDb, entityDoc);
  oramaIdMap.set(entity.id!, entityResult);

  if (claims.length > 0) {
    const claimDocs: SearchDocument[] = claims.map(claim => ({
      id: claim.id!,
      type: 'claim',
      title: entity.name,
      content: compressText(claim.statement),
      keywords: [entity.id!, claim.source || 'unknown'].join(','),
    }));

    const claimOramaIds = await insertMultiple(oramaDb, claimDocs);
    for (let i = 0; i < claims.length; i++) {
      oramaIdMap.set(claims[i].id!, claimOramaIds[i]);
    }
  }
};

export const initSearch = async () => {
  if (oramaDb) return oramaDb;

  try {
    oramaDb = create({
      schema: searchSchema,
    }) as Orama<OramaSchema>;

    const [entities, allClaims] = await Promise.all([
      repository.getAllEntities(),
      repository.getAllClaims(),
    ]);

    // Group claims by entity_id for efficient lookup
    const claimsByEntity = new Map<string, Claim[]>();
    for (const claim of allClaims) {
      const list = claimsByEntity.get(claim.entity_id) || [];
      list.push(claim);
      claimsByEntity.set(claim.entity_id, list);
    }

    const docs: SearchDocument[] = [];
    const originalIds: string[] = [];

    for (const entity of entities) {
      docs.push({
        id: entity.id!,
        type: 'entity',
        title: entity.name,
        content: compressText(`${entity.name} ${entity.description || ''}`),
        keywords: entity.type,
      });
      originalIds.push(entity.id!);

      const claims = claimsByEntity.get(entity.id!) || [];
      for (const claim of claims) {
        docs.push({
          id: claim.id!,
          type: 'claim',
          title: entity.name,
          content: compressText(claim.statement),
          keywords: [entity.id!, claim.source || 'unknown'].join(','),
        });
        originalIds.push(claim.id!);
      }
    }

    if (docs.length > 0) {
      const oramaIds = await insertMultiple(oramaDb, docs);
      for (let i = 0; i < originalIds.length; i++) {
        oramaIdMap.set(originalIds[i], oramaIds[i]);
      }
    }

    // Bulk hydrate SQLite FTS5 index
    await repository.exec('INSERT INTO entity_search_idx(entity_search_idx) VALUES(\'rebuild\')');
    await repository.exec('INSERT INTO claim_search_idx(claim_search_idx) VALUES(\'rebuild\')');

    logger.info(`Orama search index initialized with ${entities.length} entities and ${allClaims.length} claims`);

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

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Upserts an entity and its claims to the search index.
 * Debounced by 500ms to prevent redundant work during fast edit bursts.
 */
export const upsertToSearchIndex = async (entityId: string) => {
  if (debounceTimers.has(entityId)) {
    clearTimeout(debounceTimers.get(entityId));
  }

  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      void (async () => {
        debounceTimers.delete(entityId);

      if (!oramaDb) await initSearch();

      try {
        // Fetch everything once
        const entity = await repository.getEntityById(entityId);
        if (!entity) return;

        const claims = await repository.getClaimsByEntityId(entityId);

        // Optimized removal using pre-fetched data
        await removeFromSearchIndex(entityId, entity, claims);

        // Optimized Orama insertion using insertMultiple
        await addEntityToIndex(entity, claims);

        // Incrementally update SQLite FTS5 index using set-based INSERT
        await repository.exec({
          sql: `INSERT INTO entity_search_idx(rowid, name, description) VALUES (?, ?, ?)`,
          bind: [entity.rowid, entity.name, entity.description || '']
        });

        if (claims.length > 0) {
          await repository.exec({
            sql: `INSERT INTO claim_search_idx(rowid, statement)
                  SELECT rowid, statement FROM claims WHERE entity_id = ?`,
            bind: [entityId]
          });
        }
      } catch (err) {
        logger.error(`Failed to upsert entity ${entityId} to search index`, err);
      }
      resolve();
      })();
    }, 500);
    debounceTimers.set(entityId, timer);
  });
};

/**
 * Removes an entity and its claims from the search index.
 */
export const removeFromSearchIndex = async (
  entityId: string,
  providedEntity?: Entity & { rowid: number },
  providedClaims?: (Claim & { rowid: number })[]
) => {
  if (!oramaDb) return;

  try {
    const oramaInternalId = oramaIdMap.get(entityId);
    const oramaRemovals: Promise<unknown>[] = [];

    if (oramaInternalId) {
      oramaRemovals.push(remove(oramaDb, oramaInternalId));
      oramaIdMap.delete(entityId);
    }

    // SQLite FTS5 removal for entity
    const entity = providedEntity ?? await repository.getEntityById(entityId);
    if (entity) {
      await repository.exec({
        sql: `DELETE FROM entity_search_idx WHERE rowid = ?`,
        bind: [entity.rowid]
      });
    }

    const claims = providedClaims ?? await repository.getClaimsByEntityId(entityId);
    for (const claim of claims) {
      const claimOramaId = oramaIdMap.get(claim.id!);
      if (claimOramaId) {
        oramaRemovals.push(remove(oramaDb, claimOramaId));
        oramaIdMap.delete(claim.id!);
      }
    }

    // Single set-based SQLite FTS5 removal for all claims of this entity
    await repository.exec({
      sql: `DELETE FROM claim_search_idx WHERE rowid IN (SELECT rowid FROM claims WHERE entity_id = ?)`,
      bind: [entityId]
    });

    if (oramaRemovals.length > 0) {
      await Promise.all(oramaRemovals);
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
    const doc = hit.document;
    return {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      content: doc.content,
    };
  });
};
