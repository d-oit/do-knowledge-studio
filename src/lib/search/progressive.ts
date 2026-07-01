import { insert, insertMultiple, remove, search } from '@orama/orama';
import { repository, RankedResult } from '../../db/repository';
import { logger } from '../logger';
import { AppError } from '../errors';
import { compressText } from '../nlp';
import { perf } from '../perf';
import type { Entity, Claim } from '../../lib/validation';
import {
  oramaDb,
  oramaIdMap,
  addToOramaMap,
  embeddingsReady,
  embeddingsPlugin,
  createOramaIndex,
} from './orama-index';
import { hydrateFts5Index } from './fts5-hydrator';

interface SearchDocument {
  id: string;
  type: 'entity' | 'claim' | 'note';
  title: string;
  content: string;
  keywords: string;
  embedding?: number[];
}

const buildEntityDoc = (entity: Entity): SearchDocument => ({
  id: entity.id!,
  type: 'entity',
  title: entity.name,
  content: compressText(`${entity.name} ${entity.description || ''}`),
  keywords: entity.type,
});

const buildClaimDoc = (claim: Claim, entityName: string, entityId: string): SearchDocument => ({
  id: claim.id!,
  type: 'claim',
  title: entityName,
  content: compressText(claim.statement),
  keywords: [entityId, claim.source || 'unknown'].join(','),
});

const buildNoteDoc = (note: { id: string; content: string; entity_id?: string | null }, entityName?: string): SearchDocument => ({
  id: note.id,
  type: 'note',
  title: entityName || 'Note',
  content: compressText(note.content),
  keywords: note.entity_id || 'unlinked',
});

const addEntityToIndex = async (entity: Entity, claims: Claim[]): Promise<void> => {
  if (!oramaDb) return;

  const entityResult = await insert(oramaDb, buildEntityDoc(entity));
  addToOramaMap(entity.id!, entityResult);

  if (claims.length > 0) {
    const claimDocs = claims.map(c => buildClaimDoc(c, entity.name, entity.id!));
    const claimOramaIds = await insertMultiple(oramaDb, claimDocs);
    for (let i = 0; i < claims.length; i++) {
      addToOramaMap(claims[i].id!, claimOramaIds[i]);
    }
  }
};

export const initSearch = async () => {
  if (oramaDb) return oramaDb;
  perf.mark('orama-init');

  try {
    const db = createOramaIndex();
    const allClaims = await repository.getAllClaims();

    const claimsByEntity = new Map<string, Claim[]>();
    for (const claim of allClaims) {
      const list = claimsByEntity.get(claim.entity_id) || [];
      list.push(claim);
      claimsByEntity.set(claim.entity_id, list);
    }

    const CHUNK_SIZE = 100;
    let totalEntitiesIndexed = 0;
    let hasMore = true;
    let fetchOffset = 0;
    const entityNames = new Map<string, string>();

    while (hasMore) {
      const chunk = await repository.getAllEntities({ limit: CHUNK_SIZE, offset: fetchOffset });
      if (chunk.length === 0) {
        hasMore = false;
        break;
      }

      const docs: SearchDocument[] = [];
      const originalIds: string[] = [];

      for (const entity of chunk) {
        entityNames.set(entity.id!, entity.name);
        docs.push(buildEntityDoc(entity));
        originalIds.push(entity.id!);

        const claims = claimsByEntity.get(entity.id!) || [];
        for (const claim of claims) {
          docs.push(buildClaimDoc(claim, entity.name, entity.id!));
          originalIds.push(claim.id!);
        }
      }

      if (docs.length > 0) {
        const oramaIds = await insertMultiple(db, docs);
        for (let i = 0; i < originalIds.length; i++) {
          addToOramaMap(originalIds[i], oramaIds[i]);
        }
      }

      totalEntitiesIndexed += chunk.length;
      fetchOffset += CHUNK_SIZE;
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    await hydrateFts5Index();

    // Index notes
    const allNotes = await repository.getAllNotes();
    const noteDocs: SearchDocument[] = [];
    const noteIds: string[] = [];

    for (const note of allNotes) {
      if (note.content && note.content.trim().length > 0) {
        const entityName = note.entity_id
          ? entityNames.get(note.entity_id)
          : undefined;
        noteDocs.push(buildNoteDoc(note, entityName));
        noteIds.push(note.id);
      }
    }

    if (noteDocs.length > 0) {
      const oramaIds = await insertMultiple(db, noteDocs);
      for (let i = 0; i < noteIds.length; i++) {
        addToOramaMap(noteIds[i], oramaIds[i]);
      }
    }

    perf.measure('orama-init', 'orama-init');
    logger.info(`Orama search index initialized with ${totalEntitiesIndexed} entities, ${allClaims.length} claims, ${noteDocs.length} notes`);

    return db;
  } catch (err) {
    logger.error('Failed to initialize search index', err);
    throw err;
  }
};

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
          const entity = await repository.getEntityById(entityId);
          if (!entity) return;

          const claims = await repository.getClaimsByEntityId(entityId);
          await removeFromSearchIndex(entityId, entity, claims);
          await addEntityToIndex(entity, claims);

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

const noteDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const upsertNoteToSearchIndex = async (noteId: string) => {
  if (noteDebounceTimers.has(noteId)) {
    clearTimeout(noteDebounceTimers.get(noteId));
  }

  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      void (async () => {
        noteDebounceTimers.delete(noteId);

        if (!oramaDb) await initSearch();

        try {
          const notes = await repository.getAllNotes();
          const note = notes.find(n => n.id === noteId);
          if (!note) return;

          // Remove old note from index if it exists
          const oramaInternalId = oramaIdMap.get(noteId);
          if (oramaInternalId) {
            await remove(oramaDb, oramaInternalId);
            oramaIdMap.delete(noteId);
          }

          // Add updated note to index
          const entityName = note.entity_id
            ? (await repository.getEntityById(note.entity_id))?.name
            : undefined;
          const noteDoc = buildNoteDoc(note, entityName);
          const oramaId = await insert(oramaDb, noteDoc);
          addToOramaMap(noteId, oramaId);
        } catch (err) {
          logger.error(`Failed to upsert note ${noteId} to search index`, err);
        }
        resolve();
      })();
    }, 500);
    noteDebounceTimers.set(noteId, timer);
  });
};

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

const mapVerificationStage = (status: string): RankedResult['stage'] => {
  switch (status) {
    case 'verified': return 'verified';
    case 'disputed': return 'final';
    default: return 'draft';
  }
};

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
      title: doc.title,
      type: doc.type,
      content: doc.content,
      score: hit.score,
      stage: mapVerificationStage(rawStage),
    };
  });
};

export const searchKnowledge = async (
  query: string,
  options?: { type?: string; limit?: number },
): Promise<RankedResult[]> => {
  if (!oramaDb) await initSearch();
  perf.mark('orama-query');

  const searchParams: Record<string, unknown> = {
    term: query,
    properties: ['title', 'content'],
    limit: options?.limit ?? 20,
  };

  if (options?.type) {
    searchParams.where = { type: options.type };
  }

  const results = await search(oramaDb!, searchParams);
  perf.measure('orama-query-time', 'orama-query');
  return enrichResults(results.hits.map(h => ({ document: h.document as SearchDocument, score: h.score })));
};

export const semanticSearch = async (
  query: string,
  options?: { type?: string; limit?: number },
): Promise<RankedResult[]> => {
  if (!oramaDb) await initSearch();
  perf.mark('orama-query');

  if (!embeddingsReady || !embeddingsPlugin) {
    const results = await searchKnowledge(query, options);
    perf.measure('orama-query-time', 'orama-query');
    return results;
  }

  const searchParams: Record<string, unknown> = {
    term: query,
    mode: 'hybrid',
    hybrid: {
      semantic: 0.5,
      fulltext: 0.5,
    },
    properties: ['title', 'content'],
    limit: options?.limit ?? 20,
  };

  if (options?.type) {
    searchParams.where = { type: options.type };
  }

  const results = await search(oramaDb!, searchParams);
  perf.measure('orama-query-time', 'orama-query');
  return enrichResults(results.hits.map(h => ({ document: h.document as SearchDocument, score: h.score })));
};

export type ProgressiveSearchCallback = (results: RankedResult[], stage: 'exact' | 'semantic' | 'related') => void | Promise<void>;

export const progressiveSearch = async (
  query: string,
  onResults: ProgressiveSearchCallback,
  options?: { type?: string; limit?: number; signal?: AbortSignal; semantic?: boolean },
): Promise<void> => {
  if (options?.signal?.aborted) return;

  const exactResults = await searchKnowledge(query, { ...options, type: options?.type });
  if (options?.signal?.aborted) return;
  void onResults(exactResults, 'exact');

  if (options?.semantic !== false && embeddingsReady && embeddingsPlugin) {
    const semanticResults = await semanticSearch(query, { ...options, type: options?.type });
    if (options?.signal?.aborted) return;
    void onResults(semanticResults, 'semantic');
  }

  try {
    const exactIds = new Set(exactResults.map(r => r.id));
    const relatedResults = await repository.searchRelated(query, { excludeIds: exactIds });
    if (options?.signal?.aborted) return;
    if (relatedResults.length > 0) {
      void onResults(relatedResults, 'related');
    }
  } catch (err) {
    logger.error('Related search failed', err);
    throw new AppError('Related search failed', 'SEARCH_FAILED', err, 'Search encountered an error', true);
  }
};

const noteParentEntityMap = new Map<string, string>();

export const getNoteParentEntityId = (noteId: string): string | undefined =>
  noteParentEntityMap.get(noteId);

export const clearNoteParentEntityMap = (): void => {
  noteParentEntityMap.clear();
};
