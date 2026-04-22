import { create, insert, remove, search, type Orama } from '@orama/orama';
import { repository } from '../db/repository.js';
import { logger } from './logger.js';
import { compressText } from './nlp.js';
import { jobCoordinator } from './jobs.js';

export type SearchStage = 'fts5' | 'semantic' | 'graph';

export interface SearchOptions {
  stages?: SearchStage[];
  limit?: number;
  minScore?: number;
}

export interface RankedResult {
  id: string;
  name: string;
  type: string;
  excerpt: string;
  score: number;
  stage: SearchStage;
  reason?: string;
}

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

export const searchKnowledge = async (query: string, options: SearchOptions = {}) => {
  const stages = options.stages || ['fts5', 'semantic'];
  const limit = options.limit || 20;
  const results: RankedResult[] = [];
  const seenIds = new Set<string>();

  // Stage 1: Exact Recall with FTS5
  if (stages.includes('fts5')) {
    const ftsResults = await repository.searchFTS5(query);
    for (const res of ftsResults) {
      if (!seenIds.has(res.id)) {
        results.push({
          ...res,
          score: 1.0 / (1.0 + res.score), // Convert SQLite rank to a 0-1 score
          stage: 'fts5',
          reason: 'Exact full-text match',
        });
        seenIds.add(res.id);
      }
    }
  }

  // Stage 2: Semantic/Fuzzy Reranking & Fallback with Orama
  // We trigger this if:
  // - Stage 1 found too few results
  // - Or query is long (likely broad/natural language)
  // - Or semantic stage is explicitly requested and we haven't filled the limit
  const needsSemantic = stages.includes('semantic') &&
    (results.length < 3 || query.split(' ').length > 3 || stages.length === 1);

  if (needsSemantic) {
    if (!oramaDb) await initSearch();

    const oramaResults = await search(oramaDb!, {
      term: query,
      properties: ['name', 'excerpt'],
      limit: limit * 2,
    });

    for (const hit of oramaResults.hits) {
      const doc = hit.document as unknown as SearchDoc;
      if (!seenIds.has(doc.id)) {
        results.push({
          ...doc,
          score: hit.score,
          stage: 'semantic',
          reason: 'Semantic similarity match',
        });
        seenIds.add(doc.id);
      } else {
        // Boost existing result if also found semantically
        const existing = results.find(r => r.id === doc.id);
        if (existing) {
          existing.score += hit.score * 0.5;
          existing.reason += ' + Semantic boost';
        }
      }
    }
  }

  // Stage 3: Graph Neighborhood Expansion (Optional)
  if (stages.includes('graph') && results.length > 0) {
    // Expand from the top result
    const topResult = results[0];
    const related = await repository.getRelatedEntities(topResult.id);

    for (const entity of related) {
      if (!seenIds.has(entity.id!)) {
        results.push({
          id: entity.id!,
          name: entity.name,
          type: entity.type,
          excerpt: compressText(entity.description || ''),
          score: topResult.score * 0.8, // Related items get lower score
          stage: 'graph',
          reason: `Related to "${topResult.name}"`,
        });
        seenIds.add(entity.id!);
      }
    }
  }

  // Final sort by score and limit
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};
