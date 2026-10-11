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
  /** Label for keyword search mode toggle. */
  'search.keywordMode': 'Keyword',
  /** Label for ranked search mode toggle. */
  'search.rankedMode': 'Ranked',
  /** Search input placeholder. */
  'search.placeholder': 'Search knowledge base…',
  /** Accessible label of the search input. */
  'search.ariaLabel': 'Search knowledge base',
  /** Clear search input button label. */
  'search.clearAriaLabel': 'Clear panel search',
  /** Search empty state when a query is present. */
  'search.empty': 'No matches found.',
  /** Search empty state when the library has no entities. */
  'search.libraryEmpty': 'Your library is empty.',
  /** Button text to create a new entity from query in empty state. */
  'search.createEntity': (query: string) => `Create "${query}" as new entity`,
  /** Footer summary of local search entity count. */
  'search.localSearchCount': (count: string) => `Local search · ${count} entities`,
  /** Accessible label of ranked search results list. */
  'search.rankedResultsAriaLabel': 'Ranked search results',
  /** Accessible label of keyword search results list. */
  'search.keywordResultsAriaLabel': 'Keyword search results',
  /** Search results status announcement. */
  'search.resultsCount': (count: string) =>
    `${count} search ${Number(count) === 1 ? 'result' : 'results'} found`,
} as const

/** Typed `translate` helper bound to the search message scope. */
export const translate = makeT(messages)
