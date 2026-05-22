import { create, insert, insertMultiple, remove, search, type Orama } from '@orama/orama';
import { pluginEmbeddings } from '@orama/plugin-embeddings';
import { repository } from '../db/repository.js';
import { logger } from './logger.js';
import { compressText } from './nlp.js';
import { jobCoordinator } from './jobs.js';
import { resolveUrl } from './resolver.js';
import type { Entity, Claim } from '../lib/validation.js';

interface SearchDocument {
  id: string;
  type: 'entity' | 'claim';
  title: string;
  content: string;
  keywords: string;
  embedding?: number[];
}

const searchSchema = {
  id: 'string',
  type: 'string',
  title: 'string',
  content: 'string',
  keywords: 'string',
  embedding: 'vector[384]',
} as const;
/** The Orama schema type inferred from the search schema definition. */
export type OramaSchema = typeof searchSchema;

let oramaDb: Orama<OramaSchema> | null = null;
let embeddingsReady = false;
let embeddingsPlugin: ReturnType<typeof pluginEmbeddings> | null = null;
const oramaIdMap = new Map<string, string>(); // entityId → oramaInternalId

// --- Eager handler registration (must be ready before initSearch runs) ---
jobCoordinator.registerHandler('external-fetch', async (payload) => {
  const { url, entityId } = payload as { url: string; entityId: string };
  await handleExternalFetch(url, entityId);
});

/**
 * Lazily initializes the embeddings plugin for semantic search.
 * Downloads the model (~80MB) on first call — runs in background, non-blocking.
 * @returns True if embeddings are ready, false if still loading or failed.
 */
export const initEmbeddings = async (): Promise<boolean> => {
  if (embeddingsReady) return true;
  if (embeddingsPlugin) return false; // already loading

  try {
    embeddingsPlugin = pluginEmbeddings({
      model: 'Xenova/all-MiniLM-L6-v2',
      property: 'embedding',
    });
    embeddingsReady = true;
    logger.info('Semantic embeddings plugin initialized');
    return true;
  } catch (err) {
    logger.warn('Semantic embeddings unavailable — falling back to keyword search', err);
    embeddingsPlugin = null;
    return false;
  }
};

/** Builds a SearchDocument for an Entity. */
const buildEntityDoc = (entity: Entity): SearchDocument => ({
  id: entity.id!,
  type: 'entity',
  title: entity.name,
  content: compressText(`${entity.name} ${entity.description || ''}`),
  keywords: entity.type,
});

/** Builds a SearchDocument for a Claim associated with an entity. */
const buildClaimDoc = (claim: Claim, entityName: string, entityId: string): SearchDocument => ({
  id: claim.id!,
  type: 'claim',
  title: entityName,
  content: compressText(claim.statement),
  keywords: [entityId, claim.source || 'unknown'].join(','),
});

const addEntityToIndex = async (entity: Entity, claims: Claim[]): Promise<void> => {
  if (!oramaDb) return;

  const entityResult = await insert(oramaDb, buildEntityDoc(entity));
  oramaIdMap.set(entity.id!, entityResult);

  if (claims.length > 0) {
    const claimDocs = claims.map(c => buildClaimDoc(c, entity.name, entity.id!));
    const claimOramaIds = await insertMultiple(oramaDb, claimDocs);
    for (let i = 0; i < claims.length; i++) {
      oramaIdMap.set(claims[i].id!, claimOramaIds[i]);
    }
  }
};

/**
 * Initializes the Orama full-text search index.
 * Loads all entities and claims from SQLite, builds Orama documents,
 * and bulk-inserts them into the index. Also hydrates SQLite FTS5 virtual tables.
 * Registers job handlers for incremental reindexing.
 * @returns The initialized Orama database instance.
 * @throws If index initialization fails.
 */
export const initSearch = async () => {
  if (oramaDb) return oramaDb;

  try {
    const plugins: unknown[] = [];
    // Attach embeddings plugin if ready; otherwise init without it
    if (embeddingsPlugin) {
      plugins.push(embeddingsPlugin);
    }

    oramaDb = create({
      schema: searchSchema,
      ...(plugins.length > 0 ? { plugins } : {}),
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
      docs.push(buildEntityDoc(entity));
      originalIds.push(entity.id!);

      const claims = claimsByEntity.get(entity.id!) || [];
      for (const claim of claims) {
        docs.push(buildClaimDoc(claim, entity.name, entity.id!));
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
 * Handles external URL fetch for entity auto-hydration.
 * Fetches content from the URL, updates the entity description,
 * and caches the result for offline use.
 */
const handleExternalFetch = async (url: string, entityId: string): Promise<void> => {
  try {
    logger.info('Handling external fetch for entity', { entityId, url });

    // Check cache first — if we have cached content, skip the network
    const cached = await repository.getWebCache(url);
    let resolved: { url: string; title: string; content: string; format: 'markdown' | 'plain'; wordCount: number; provider: string };
    if (cached?.content) {
      logger.info('Using cached web content', { url, cachedAt: cached.resolved_at });
      resolved = {
        url,
        title: cached.title || '',
        content: cached.content,
        format: (cached.format as 'markdown' | 'plain') || 'plain',
        wordCount: cached.content.split(/\s+/).filter(Boolean).length,
        provider: 'cache' as const,
        cachedAt: cached.resolved_at,
      };
    } else {
      resolved = await resolveUrl(url);
    }

    if (resolved.content) {
      // Update entity description with resolved content
      const titleToUse = resolved.title || '';
      const description = titleToUse
        ? `${titleToUse}\n\n${resolved.content}`
        : resolved.content;

      await repository.updateEntity(entityId, {
        description,
      });

      // Cache for offline use
      await repository.upsertWebCache(url, resolved.content, resolved.title, resolved.format);

      // Reindex the entity in search
      await upsertToSearchIndex(entityId);

      logger.info('Entity auto-hydrated from external URL', {
        entityId,
        url,
        provider: resolved.provider,
        words: resolved.wordCount,
      });
    }
  } catch (err) {
    logger.error('Failed to auto-hydrate entity from external URL', err);
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

/** A single search result from the Orama knowledge index. */
export interface SearchResult {
  /** Entity or claim ID. */
  id: string;
  /** Entity name (or claim's entity name). */
  title: string;
  /** 'entity' or 'claim'. */
  type: string;
  /** Compressed text content for display. */
  content: string;
  stage?: string;
}

/**
 * Enhanced search result with ranking and provenance metadata.
 * Used by SearchPanel for display and keyboard navigation.
 */
export interface RankedResult {
  id: string;
  name: string;
  type: string;
  excerpt: string;
  score: number;
  stage: 'draft' | 'verified' | 'final';
}

/** Maps claim verification_status to display stage. */
const mapVerificationStage = (status: string): RankedResult['stage'] => {
  switch (status) {
    case 'verified': return 'verified';
    case 'disputed': return 'final';
    default: return 'draft';
  }
};

/**
 * Enriches raw search results with provenance data from the database.
 * Batches all claim lookups into a single query for efficiency.
 */
const enrichResults = async (hits: Array<{ document: SearchDocument; score: number }>): Promise<RankedResult[]> => {
  const claimIds = hits
    .filter(h => h.document.type === 'claim')
    .map(h => h.document.id);

  let stageMap: Map<string, string> = new Map();
  if (claimIds.length > 0) {
    try {
      stageMap = await repository.getClaimStageMap(claimIds);
    } catch (err) {
      logger.warn('Failed to enrich search results with provenance', err);
    }
  }

  return hits.map(hit => {
    const doc = hit.document;
    const rawStage = doc.type === 'claim'
      ? (stageMap.get(doc.id) ?? 'unverified')
      : 'verified';

    return {
      id: doc.id,
      name: doc.title,
      type: doc.type,
      excerpt: doc.content,
      score: hit.score,
      stage: mapVerificationStage(rawStage),
    };
  });
};

/**
 * Searches the local knowledge base using Orama full-text search.
 * Falls back to lazy initialization if the index hasn't been built yet.
 * Enriches results with real claim verification status from the database.
 * @param query - The search query string.
 * @param options - Optional filter by type.
 * @returns Array of matching RankedResult items with live provenance data.
 */
export const searchKnowledge = async (
  query: string,
  options?: { type?: string },
): Promise<RankedResult[]> => {
  if (!oramaDb) await initSearch();

  const searchParams: Record<string, unknown> = {
    term: query,
    properties: ['title', 'content'],
  };

  if (options?.type) {
    searchParams.where = { type: options.type };
  }

  const results = await search(oramaDb!, searchParams);
  return enrichResults(results.hits.map(h => ({ document: h.document as SearchDocument, score: h.score })));
};

/**
 * Performs hybrid semantic + keyword search using the embeddings plugin.
 * Falls back to keyword-only search if embeddings are not initialized.
 * @param query - The search query string.
 * @param options - Optional filter by type.
 * @returns Array of ranked search results.
 */
export const semanticSearch = async (
  query: string,
  options?: { type?: string },
): Promise<RankedResult[]> => {
  if (!oramaDb) await initSearch();

  // Fall back to keyword search if embeddings aren't ready
  if (!embeddingsReady || !embeddingsPlugin) {
    return searchKnowledge(query, options);
  }

  const searchParams: Record<string, unknown> = {
    term: query,
    mode: 'hybrid',
    hybrid: {
      semantic: 0.5,
      fulltext: 0.5,
    },
    properties: ['title', 'content'],
  };

  if (options?.type) {
    searchParams.where = { type: options.type };
  }

  const results = await search(oramaDb!, searchParams);
  return enrichResults(results.hits.map(h => ({ document: h.document as SearchDocument, score: h.score })));
};
