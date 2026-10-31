/**
 * Observable progress for semantic-index builds (Issue #1037).
 *
 * The embedding runtime is WASM in the page, not a worker, so the indexer
 * yields between bounded batches and publishes progress here. The Library UI
 * can render progress without blocking lexical search.
 */
import { logger } from '@/lib/logging/logger'

/** Lifecycle of the semantic index for the current corpus. */
export type SemanticIndexStatus =
  | 'idle'
  | 'loading-cache'
  | 'indexing'
  | 'ready'
  | 'cancelled'
  | 'error'

/** Progress snapshot consumed by the UI. */
export interface SemanticIndexProgress {
  status: SemanticIndexStatus
  completed: number
  total: number
  reason: string | null
}

/** Initial snapshot before any semantic build has run. */
export const INITIAL_SEMANTIC_PROGRESS: SemanticIndexProgress = {
  status: 'idle',
  completed: 0,
  total: 0,
  reason: null,
}

let progress: SemanticIndexProgress = { ...INITIAL_SEMANTIC_PROGRESS }
const listeners = new Set<() => void>()

const notify = (): void => {
  for (const listener of listeners) {
    try {
      listener()
    } catch (error) {
      logger.child({ area: 'search' }).error('Semantic progress listener failed', { error })
    }
  }
}

/** Current progress snapshot. */
export const getSemanticIndexProgress = (): SemanticIndexProgress => progress

/** Subscribes to progress changes; returns an unsubscribe function. */
export const subscribeSemanticIndexProgress = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Publish a new progress snapshot. */
export const setSemanticIndexProgress = (next: SemanticIndexProgress): void => {
  progress = next
  notify()
}

/** Reset to the idle snapshot (explicit cache reset). */
export const resetSemanticIndexProgress = (): void => {
  progress = { ...INITIAL_SEMANTIC_PROGRESS }
  notify()
}
