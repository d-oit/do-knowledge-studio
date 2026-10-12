/**
 * Library view i18n messages (#870).
 *
 * User-facing strings for the library view: its hero header and the two empty
 * states (no entities at all, or filters that matched nothing). The filter and
 * semantic-search labels live in their own scopes (`search`, `entity-types`).
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Hero header title of the library view. */
  'library.title': 'Library',
  /** Hero header subtitle of the library view. */
  'library.subtitle': 'Everything you have captured — searchable and filterable offline.',
  /** Empty state headline when the library holds no entities. */
  'library.empty.title': 'No entities yet',
  /** Empty state body inviting the first capture. */
  'library.empty.body':
    'Capture your first thought, concept, person, or project. Everything you save stays local and offline-ready.',
  /** Empty state action that opens a blank entity in the editor. */
  'library.empty.action': 'Create your first entity',
  /** Empty state headline when filters or the query exclude every entity. */
  'library.noMatches.title': 'No matches found',
  /** Empty state body suggesting a wider filter. */
  'library.noMatches.body':
    "Try adjusting your search terms or filters to find what you're looking for.",
  /** Empty state action that drops every filter and query. */
  'library.noMatches.action': 'Clear all filters',
} as const

/** Typed `translate` helper bound to the library message scope. */
export const translate = makeT(messages)
