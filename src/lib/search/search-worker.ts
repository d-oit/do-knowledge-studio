/**
 * Dedicated Web Worker for offloading BM25 indexing and search query execution
 * off the JavaScript main thread (TRIZ Principle #4 Asymmetry & #10 Preliminary Action).
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

/** Handles messages received by the search web worker. */
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

// Attach listener if executed within a dedicated Web Worker environment
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent<SearchWorkerRequest>) => {
    handleWorkerMessage(e.data, (reply) => {
      self.postMessage(reply)
    })
  }
}
