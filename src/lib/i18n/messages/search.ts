/**
 * Search i18n messages (N1 — semantic search).
 *
 * Owned by the search workstream. New user-facing search strings live here
 * instead of being hardcoded in views, so a future locale layer can localize
 * them. The scope prefix groups these keys under the `search.*` namespace.
 */

import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Label for the semantic search toggle in the library view. */
  'search.semanticToggleLabel': 'Semantic search',
  /** Helper text explaining what semantic search does. */
  'search.semanticToggleHint':
    'Match by meaning across languages instead of exact words.',
  /** Status shown while the multilingual embedding model is loading. */
  'search.semanticLoading': 'Loading semantic model…',
  /** Status shown when the semantic model could not be loaded. */
  'search.semanticUnavailable':
    'Semantic search unavailable — showing keyword results instead.',
  /** Accessible text describing the semantic toggle when it is turned on. */
  'search.semanticOnDescription':
    'Search by meaning is enabled. Results are ranked by semantic relevance.',
  /** Accessible text describing the semantic toggle when it is turned off. */
  'search.semanticOffDescription':
    'Search by meaning is disabled. Results use exact keyword matching.',
} as const

/** Typed `t` helper bound to the search message scope. */
export const t = makeT(messages)
