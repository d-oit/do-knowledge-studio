/**
 * Dedicated Web Worker for offloading BM25 indexing and search query execution
 * off the JavaScript main thread (TRIZ Principle #4 Asymmetry & #10 Preliminary Action).
 *
 * Semantic embedding search (N1, Issue #751) intentionally runs on the main
 * thread instead of through this worker: the worker's dynamic
 * `import('@huggingface/transformers')` never resolves under the Turbopack
 * module-worker bundling used by this repo's dev server and production
 * builds, leaving requests pending forever without any network activity.
 * The main-thread import resolves reliably, so `searchSemantic` in
 * `search-worker-client` executes the shared vector store directly.
 */

import type { Entity, Claim } from '@/lib/studio/types'
import { search, resetSearchCache, type SearchResult } from './retrieval'

export type SearchWorkerRequest =
  | {
      id: string
      type: 'SEARCH'
      entities: Entity[]
      claims: Claim[]
      query: string
      limit?: number
    }
  | {
      id: string
      type: 'RESET'
    }

export type SearchWorkerResponse =
  | {
      id: string
      type: 'SUCCESS'
      results: SearchResult[]
    }
  | {
      id: string
      type: 'RESET_SUCCESS'
    }
  | {
      id: string
      type: 'ERROR'
      error: string
    }

/**
 * Synchronous handler for SEARCH/RESET requests; errors are reported as
 * explicit ERROR replies so the worker never silently drops a request.
 */
export const handleWorkerMessage = (
  data: SearchWorkerRequest,
  postReply: (msg: SearchWorkerResponse) => void,
): void => {
  try {
    if (data.type === 'RESET') {
      resetSearchCache()
      postReply({ id: data.id, type: 'RESET_SUCCESS' })
      return
    }

    if (data.type === 'SEARCH') {
      const results = search(data.entities, data.claims, data.query, data.limit)
      postReply({ id: data.id, type: 'SUCCESS', results })
      return
    }
  } catch (err) {
    postReply({
      id: data.id,
      type: 'ERROR',
      error: err instanceof Error ? err.message : 'Unknown search worker error',
    })
  }
}

/**
 * Whether this module is executing inside a dedicated Web Worker global scope.
 *
 * A dedicated worker global scope has no `document`. The test deliberately
 * avoids `typeof window === 'undefined'`: Turbopack bundles the worker
 * entrypoint as a module chunk and resolves `window` statically, so that
 * comparison is folded to `false` at build time and the whole branch — the
 * `message` listener included — is dropped from the emitted worker chunk. The
 * worker then boots without an error but never handles a message, so every
 * request waits out `SEARCH_WORKER_TIMEOUT_MS` (3s) before the client falls
 * back to the main thread. Measured in a real browser: 3.33s per chat reply
 * before this fix, 0.33s after.
 */
const isDedicatedWorkerScope = (): boolean => {
  if (typeof self === 'undefined') return false
  return 'document' in self ? false : true
}

// Attach the listener when this module runs inside a dedicated Web Worker.
if (isDedicatedWorkerScope()) {
  self.addEventListener('message', (e: MessageEvent<SearchWorkerRequest>) => {
    handleWorkerMessage(e.data, (reply) => {
      self.postMessage(reply)
    })
  })
}