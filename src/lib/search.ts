import { create, insert, search, type Orama } from '@orama/orama';
import { repository } from '../db/repository.js';
import { logger } from './logger.js';
import { compressText } from './nlp.js';

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
    return oramaDb;
  } catch (err) {
    logger.error('Failed to initialize search index', err);
    throw err;
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

export const searchKnowledge = async (query: string) => {
  if (!oramaDb) await initSearch();

  const results = await search(oramaDb!, {
    term: query,
    properties: ['name', 'excerpt'],
  });

  return results.hits.map(hit => hit.document);
};
