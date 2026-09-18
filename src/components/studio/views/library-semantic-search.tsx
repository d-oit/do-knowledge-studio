'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { translate } from '@/lib/i18n/messages/search'
import {
  searchSemantic,
  type SemanticSearchOutcome,
  type SemanticDocFilter,
} from '@/lib/search/search-worker-client'
import type { AnyEntityType, Claim, Entity } from '@/lib/studio/types'

/**
 * Ranked results returned by a semantic query. Deliberately larger than the
 * grid's render cap so the "Show all" expansion has results to reveal; the
 * render limit is a grid concern, not a retrieval concern.
 */
const SEMANTIC_RESULT_LIMIT = 100

/** Debounce before running a semantic search so keystrokes do not re-embed. */
const SEMANTIC_DEBOUNCE_MS = 300

/**
 * Builds the search filter for the active type filter — `undefined` for 'all'.
 * Applied INSIDE the search so ranking and truncation happen within the
 * filtered set: a post-hoc filter over the top-100 could hide matching
 * entities that rank below the cut.
 */
const buildTypeFilter = (
  typeFilter: AnyEntityType | 'all',
): SemanticDocFilter | undefined =>
  typeFilter === 'all' ? undefined : (doc) => doc.entityType === typeFilter

/**
 * Runs a debounced, abortable semantic search whenever the toggle is on and a
 * query exists. Every keystroke/toggle/type-filter change aborts the in-flight
 * request; because the embedder is a lazy singleton, the first query pays the
 * model download and later ones reuse it. Returns the outcome plus a busy flag.
 */
export const useSemanticSearch = (
  semanticMode: boolean,
  query: string,
  allEntities: Entity[],
  claims: Claim[],
  typeFilter: AnyEntityType | 'all',
) => {
  const [semanticOutcome, setSemanticOutcome] = useState<SemanticSearchOutcome | null>(null)
  const [semanticBusy, setSemanticBusy] = useState(false)
  const semanticQuery = query.trim()

  useEffect(() => {
    let cancelled = false
    let controller: AbortController | null = null
    let debounce: number | undefined
    if (semanticMode && semanticQuery !== '') {
      controller = new AbortController()
      setSemanticOutcome(null)
      setSemanticBusy(true)
      // The async IIFE is `void`-ed because nothing awaits it; the timer owns
      // the timer handle and the rejection is handled inside try/catch, so the
      // promise can never surface as an unhandled rejection.
      debounce = window.setTimeout(() => {
        void (async () => {
          try {
            const outcome = await searchSemantic(
              allEntities,
              claims,
              semanticQuery,
              SEMANTIC_RESULT_LIMIT,
              controller?.signal,
              buildTypeFilter(typeFilter),
            )
            if (cancelled) return
            setSemanticOutcome(outcome)
            setSemanticBusy(false)
          } catch (err: unknown) {
            if (cancelled) return
            // Only aborts reject; surface anything else as a lexical fallback
            // so the search box never dies silently.
            if (err instanceof DOMException && err.name === 'AbortError') return
            console.error('Semantic search failed:', err)
            // Clear — not `{ source: 'lexical', results: [] }` — so the grid
            // falls back to the lexical `filteredEntities` rather than an
            // empty semantic result list.
            setSemanticOutcome(null)
            setSemanticBusy(false)
          }
        })()
      }, SEMANTIC_DEBOUNCE_MS)
    } else {
      setSemanticOutcome(null)
      setSemanticBusy(false)
    }
    return () => {
      cancelled = true
      clearTimeout(debounce)
      controller?.abort()
    }
  }, [semanticMode, semanticQuery, allEntities, claims, typeFilter])

  return { semanticOutcome, semanticBusy }
}

/** Looks up the entity a semantic result refers to (id, or claim id via its entity). */
const entityForResult = (
  result: SemanticSearchOutcome['results'][number],
  entityById: Map<string, Entity>,
): Entity | undefined =>
  entityById.get(result.id) ??
  (result.entityId !== undefined ? entityById.get(result.entityId) : undefined)

/** Whether an entity passes the current type filter. */
const passesTypeFilter = (
  entity: Entity,
  typeFilter: AnyEntityType | 'all',
): boolean => typeFilter === 'all' || entity.type === typeFilter

/**
 * Resolves ranked semantic result ids (entity ids, or claim ids via their
 * entity) to entities in rank order — deduped and type-filtered — mirroring
 * what the lexical path renders into the grid/table.
 */
export const resolveSemanticEntities = (
  outcome: SemanticSearchOutcome,
  entityById: Map<string, Entity>,
  typeFilter: AnyEntityType | 'all',
): Entity[] => {
  const seen = new Set<string>()
  const resolved: Entity[] = []
  for (const result of outcome.results) {
    const entity = entityForResult(result, entityById)
    if (entity === undefined || seen.has(entity.id)) continue
    if (!passesTypeFilter(entity, typeFilter)) continue
    seen.add(entity.id)
    resolved.push(entity)
  }
  return resolved
}

/** Surfaces semantic-search loading and lexical-fallback states under the controls. */
export const SemanticStatusBanner = ({
  active,
  busy,
  outcome,
}: {
  active: boolean
  busy: boolean
  outcome: SemanticSearchOutcome | null
}) => {
  if (!active) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-center gap-2 text-caption text-ink-faint"
    >
      {busy ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {translate('search.semanticLoading')}
        </>
      ) : outcome?.source === 'semantic' ? (
        <>
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {translate('search.semanticOnDescription')}
        </>
      ) : (
        <span>{translate('search.semanticUnavailable')}</span>
      )}
    </div>
  )
}
