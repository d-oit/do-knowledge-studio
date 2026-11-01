/**
 * Settings view i18n messages (Plan 192 follow-up).
 *
 * User-facing strings for the storage report: what the semantic index and the
 * model cache cost, and what dropping either one does.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Hero header title. */
  'settings.title': 'Settings',
  /** Hero header subtitle. */
  'settings.subtitle': 'What this studio stores locally, and how to reclaim it.',
  /** Section heading for the semantic index. */
  'settings.semantic.title': 'Semantic index',
  /** Explains what the semantic index is and that it can be rebuilt. */
  'settings.semantic.description':
    'Vectors for every entity and claim, held in memory and cached in IndexedDB. Rebuilding is safe: the content itself is not touched.',
  /** Label for the document count. */
  'settings.semantic.documents': 'Documents indexed',
  /** Label for the in-memory size. */
  'settings.semantic.bytes': 'Memory in use',
  /** Label for the configured ceiling. */
  'settings.semantic.budget': 'Memory budget',
  /** Label for the index lifecycle state. */
  'settings.semantic.status': 'Status',
  /** Button that drops the index so the next search rebuilds it. */
  'settings.semantic.rebuild': 'Rebuild index',
  /** Confirmation that the index was dropped. */
  'settings.semantic.rebuilt': 'Semantic index cleared',
  /** Explanation shown under the rebuild button. */
  'settings.semantic.rebuildHint':
    'The next semantic search re-embeds the library. On a cold model this downloads it again.',
  /** Section heading for the embedding-model cache. */
  'settings.model.title': 'Model cache',
  /** Explains what the model cache holds. */
  'settings.model.description':
    'Embedding-model weights and tokenizer files, kept offline so a reload never needs the network.',
  /** Label for the cached file count. */
  'settings.model.entries': 'Cached files',
  /** Label for the cache size on disk. */
  'settings.model.bytes': 'Disk in use',
  /** Label for the cache ceiling. */
  'settings.model.budget': 'Cache budget',
  /** Button that deletes the model cache. */
  'settings.model.clear': 'Clear model cache',
  /** Confirmation that the cache was deleted. */
  'settings.model.cleared': 'Model cache cleared',
  /** Shown when there was nothing to delete. */
  'settings.model.empty': 'No cached model files',
  /** Explanation shown under the clear button. */
  'settings.model.clearHint':
    'The next semantic search downloads the model again, which needs a network connection.',
  /** Shown when storage cannot be measured at all. */
  'settings.unavailable': 'Storage is not available in this browser',
} as const

/** Typed `translate` helper bound to the settings message scope. */
export const translate = makeT(messages)
