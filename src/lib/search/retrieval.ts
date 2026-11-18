/**
 * Lexical BM25 retrieval — thin facade over the shared `dks-core` engine.
 *
 * The ranking implementation (tokenization, BM25 scoring, snippet
 * generation, caching) lives once in `packages/dks-core/src/pwa-retrieval.ts`
 * and is shared verbatim with the `dks` CLI and the optional MCP adapter, so
 * every consumer asks the same engine and gets the same answers. This file
 * keeps the historical module path and public API for the PWA.
 */

export {
  search,
  getEntityMap,
  resetSearchCache,
  MAX_CACHE_ENTRIES,
} from 'dks-core/pwa-retrieval'
export type {
  SearchResult,
  SearchFilter,
  FilterableDoc,
} from 'dks-core/pwa-retrieval'
