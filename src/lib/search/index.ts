import { jobCoordinator } from '../jobs';
import { clearOramaDb } from './orama-index';
import { handleExternalFetch } from './external-fetch';
import {
  initSearch,
  upsertToSearchIndex,
  removeFromSearchIndex,
  searchKnowledge,
  semanticSearch,
  progressiveSearch,
  type ProgressiveSearchCallback
} from './progressive';
import { logger } from '../logger';
import { RankedResult } from '../../db/repository';

export * from './orama-index';
export * from './fts5-hydrator';
export * from './external-fetch';
export {
  initSearch,
  upsertToSearchIndex,
  removeFromSearchIndex,
  searchKnowledge,
  semanticSearch,
  progressiveSearch,
  RankedResult,
  type ProgressiveSearchCallback
};

// --- Eager handler registration ---
jobCoordinator.registerHandler('external-fetch', async (payload) => {
  const { url, entityId } = payload as { url: string; entityId: string };
  await handleExternalFetch(url, entityId, upsertToSearchIndex);
});

jobCoordinator.registerHandler('reindex-document', async (payload) => {
  const { entityId } = payload as { entityId: string };
  await upsertToSearchIndex(entityId);
});

jobCoordinator.registerHandler('refresh-search-index', async () => {
  clearOramaDb();
  await initSearch();
});

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
  stage?: string;
}
