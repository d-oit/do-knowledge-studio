'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import type { AnyEntityType, Claim, Entity } from '@/lib/studio/types'
import { translate } from '@/lib/i18n/messages/search'
import { searchSemantic, type SemanticSearchOutcome } from '@/lib/search/search-worker-client'

/**
 * Ranked results returned by a semantic query. Deliberately larger than the
 * render cap so the "Show all" expansion has results to reveal; the render
 * limit is a grid concern, not a retrieval concern.
 */
const SEMANTIC_RESULT_LIMIT = 100

/** Debounce before running a semantic search so keystrokes do not re-embed. */
const SEMANTIC_DEBOUNCE_MS = 300

/** Whether an entity passes the current type filter. */
export const passesTypeFilter = (
  entity: Entity,
  typeFilter: AnyEntityType | 'all',
): boolean => typeFilter === 'all' || entity.type === typeFilter

/**
 * Narrows the retrieval corpus to the active type filter *before* the query is
 * embedded. The retriever truncates to `SEMANTIC_RESULT_LIMIT`, so filtering
 * the returned hits instead would discard every entity of the wanted type that
 * ranked outside that global top-N (worst case: a type filter returning
 * nothing at all). Rebuilding the index when the filter changes is the cost.
 */
export const narrowSemanticCorpus = (
  entities: Entity[],
  claims: Claim[],
  typeFilter: AnyEntityType | 'all',
): { entities: Entity[]; claims: Claim[] } => {
  if (typeFilter === 'all') return { entities, claims }
  const narrowedEntities = entities.filter((entity) => passesTypeFilter(entity, typeFilter))
  const corpusIds = new Set(narrowedEntities.map((entity) => entity.id))
  return {
    entities: narrowedEntities,
    claims: claims.filter((claim) => corpusIds.has(claim.entityId)),
  }
}

/**
 * Runs a debounced, abortable semantic search whenever the toggle is on and a
 * query exists. Every keystroke/toggle aborts the in-flight request; because
 * the embedder is a lazy singleton, the first query pays the model download
 * and later ones reuse it. Returns the outcome plus a busy flag.
 */
export const useSemanticSearch = (
  semanticMode: boolean,
  query: string,
  allEntities: Entity[],
  claims: Claim[],
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
  }, [semanticMode, semanticQuery, allEntities, claims])

  return { semanticOutcome, semanticBusy }
}

/** Looks up the entity a semantic result refers to (id, or claim id via its entity). */
const entityForResult = (
  result: SemanticSearchOutcome['results'][number],
  entityById: Map<string, Entity>,
): Entity | undefined =>
  entityById.get(result.id) ??
  (result.entityId !== undefined ? entityById.get(result.entityId) : undefined)

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
