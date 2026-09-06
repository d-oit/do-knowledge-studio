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

/** Pending request bookkeeping plus a detach hook for the abort listener. */
interface PendingRequest {
  resolve: (results: SearchResult[]) => void
  reject: (error: Error) => void
  /** Detach the abort listener; invoked once the request settles. */
  cleanup?: () => void
  /** Timer that bounds the request; cleared once it settles. */
  timer?: ReturnType<typeof setTimeout>
}

/** The abort error thrown to callers of {@link SearchWorkerClient.searchAsync}. */
const abortError = (): Error => new DOMException('Search aborted', 'AbortError')

/** The error thrown when the worker fails to respond within the timeout. */
const timeoutError = (): Error => new DOMException('Search worker timed out', 'TimeoutError')

/**
 * Maximum time a worker request may stay in flight before it is treated as
 * failed. A silent worker (e.g. the chunk never loads in a dev server) would
 * otherwise leave `searchAsync` pending forever; this bound lets callers fall
 * back to synchronous search so the local-first chat always answers.
 */
export const SEARCH_WORKER_TIMEOUT_MS = 3000

/** Client for executing off-thread search queries via Web Workers. */
export class SearchWorkerClient {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, PendingRequest>()

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

  /** Remove and reject a pending request, detaching its abort listener. */
  private settle(id: string, error: Error): void {
    const pending = this.pendingRequests.get(id)
    if (!pending) return
    this.pendingRequests.delete(id)
    if (pending.timer) clearTimeout(pending.timer)
    pending.cleanup?.()
    pending.reject(error)
  }

  /** Remove and resolve a pending request successfully. */
  private resolvePending(id: string, results: SearchResult[]): void {
    const pending = this.pendingRequests.get(id)
    if (!pending) return
    this.pendingRequests.delete(id)
    if (pending.timer) clearTimeout(pending.timer)
    pending.cleanup?.()
    pending.resolve(results)
  }

  /** Attach an abort listener; rejects the pending request when the signal fires. */
  private wireAbort(id: string, signal: AbortSignal | undefined): (() => void) | undefined {
    if (!signal) return undefined
    const onAbort = () => {
      this.settle(id, abortError())
      signal.removeEventListener('abort', onAbort)
    }
    signal.addEventListener('abort', onAbort)
    return () => signal.removeEventListener('abort', onAbort)
  }

  private initWorkerListeners(): void {
    if (!this.worker) return

    this.worker.onmessage = (e: MessageEvent<SearchWorkerResponse>) => {
      const data = e.data
      const pending = this.pendingRequests.get(data.id)
      if (!pending) return
      if (data.type === 'SUCCESS') {
        this.resolvePending(data.id, data.results)
      } else if (data.type === 'ERROR') {
        this.settle(data.id, new Error(data.error))
      } else {
        this.resolvePending(data.id, [])
      }
    }

    this.worker.onerror = (e: ErrorEvent) => {
      console.error('Search worker encountered unhandled error:', e.message)
      for (const id of Array.from(this.pendingRequests.keys())) {
        this.settle(id, new Error(`Worker error: ${e.message}`))
      }
    }
  }

  /**
   * Search entities and claims asynchronously.
   * Uses Web Worker if available, otherwise executes synchronously.
   *
   * @param signal - Optional abort signal; when fired, the search is cancelled.
   */
  searchAsync(
    entities: Entity[],
    claims: Claim[],
    query: string,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<SearchResult[]> {
    if (!this.worker) {
      return signal?.aborted ? Promise.reject(abortError()) : Promise.resolve(search(entities, claims, query, limit))
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
      const cleanup = this.wireAbort(id, signal)
      // Bound the request so a silent/broken worker can't leave callers (e.g.
      // the chat) waiting forever; the caller falls back to sync search.
      const timer = setTimeout(() => {
        this.settle(id, timeoutError())
      }, SEARCH_WORKER_TIMEOUT_MS)
      this.pendingRequests.set(id, { resolve, reject, cleanup, timer })
      if (signal?.aborted) {
        this.settle(id, abortError())
        return
      }
      try {
        this.worker?.postMessage(request)
      } catch (err) {
        this.settle(id, err instanceof Error ? err : new Error('Failed to post message to worker'))
      }
    })
  }

  /** Terminate the underlying Web Worker and reject pending requests. */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    for (const id of Array.from(this.pendingRequests.keys())) {
      this.settle(id, new Error('Search worker was terminated'))
    }
  }
}

/** Default singleton instance of the search worker client. */
export const defaultSearchWorkerClient = new SearchWorkerClient()

/**
 * Convenient standalone async search helper using the default worker client.
 *
 * @param signal - Optional abort signal; when fired, the search is cancelled.
 */
export const searchAsync = (
  entities: Entity[],
  claims: Claim[],
  query: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<SearchResult[]> => {
  return defaultSearchWorkerClient.searchAsync(entities, claims, query, limit, signal)
}
