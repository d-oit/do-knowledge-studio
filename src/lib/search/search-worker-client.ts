/**
 * Asynchronous Search Worker Client with graceful fallback to synchronous in-memory search
 * for environments without Web Worker support (SSR, Node/Vitest, legacy browsers).
 */

import type { Entity, Claim } from '@/lib/studio/types'
import { search, type SearchResult } from './retrieval'
import type { SearchWorkerRequest, SearchWorkerResponse } from './search-worker'

let transactionSequence = 0

/** Generates a unique transaction ID for worker message correlation without weak RNG. */
const generateTransactionId = (): string => {
  transactionSequence += 1
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${transactionSequence}-${crypto.randomUUID()}`
  }
  return `tx-${Date.now()}-${transactionSequence}`
}

/** Client for executing off-thread search queries via Web Workers. */
export class SearchWorkerClient {
  private worker: Worker | null = null
  private pendingRequests = new Map<
    string,
    {
      resolve: (results: SearchResult[]) => void
      reject: (error: Error) => void
    }
  >()

  constructor(customWorker?: Worker) {
    if (customWorker) {
      this.worker = customWorker
      this.initWorkerListeners()
    } else if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./search-worker.ts', import.meta.url), {
          type: 'module',
        })
        this.initWorkerListeners()
      } catch (err) {
        console.error('Failed to initialize search Web Worker, falling back to main-thread search:', err)
        this.worker = null
      }
    }
  }

  private initWorkerListeners(): void {
    if (!this.worker) return

    this.worker.onmessage = (e: MessageEvent<SearchWorkerResponse>) => {
      const data = e.data
      const pending = this.pendingRequests.get(data.id)
      if (!pending) return

      this.pendingRequests.delete(data.id)
      if (data.type === 'SUCCESS') {
        pending.resolve(data.results)
      } else if (data.type === 'ERROR') {
        pending.reject(new Error(data.error))
      } else {
        pending.resolve([])
      }
    }

    this.worker.onerror = (e: ErrorEvent) => {
      console.error('Search worker encountered unhandled error:', e.message)
      for (const [id, pending] of this.pendingRequests.entries()) {
        pending.reject(new Error(`Worker error: ${e.message}`))
        this.pendingRequests.delete(id)
      }
    }
  }

  /**
   * Search entities and claims asynchronously.
   * Uses Web Worker if available, otherwise executes synchronously.
   */
  async searchAsync(
    entities: Entity[],
    claims: Claim[],
    query: string,
    limit?: number,
  ): Promise<SearchResult[]> {
    if (!this.worker) {
      return search(entities, claims, query, limit)
    }

    const id = generateTransactionId()
    const request: SearchWorkerRequest = {
      id,
      type: 'SEARCH',
      entities,
      claims,
      query,
      limit,
    }

    return new Promise<SearchResult[]>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      try {
        this.worker?.postMessage(request)
      } catch (err) {
        this.pendingRequests.delete(id)
        reject(err instanceof Error ? err : new Error('Failed to post message to worker'))
      }
    })
  }

  /** Terminate the underlying Web Worker and reject pending requests. */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error('Search worker was terminated'))
      this.pendingRequests.delete(id)
    }
  }
}

/** Default singleton instance of the search worker client. */
export const defaultSearchWorkerClient = new SearchWorkerClient()

/**
 * Convenient standalone async search helper using the default worker client.
 */
export const searchAsync = async (
  entities: Entity[],
  claims: Claim[],
  query: string,
  limit?: number,
): Promise<SearchResult[]> => {
  return defaultSearchWorkerClient.searchAsync(entities, claims, query, limit)
}
