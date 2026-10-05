'use client'

import { useState, useMemo } from 'react'
import { Search, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStudioStore, useFilteredEntities } from '@/lib/studio/store'
import { search, type SearchResult } from '@/lib/search/retrieval'
import { buildEntityIndex } from '@/lib/studio/graph-index'
import { getEntityTypeMeta, type EntityTypeMeta } from '@/lib/studio/entity-types'
import { translate } from '@/lib/i18n/messages/search'
import type { Entity } from '@/lib/studio/types'

export interface EntitySearchPanelProps {
  onSelect?: (id: string) => void
  onCreateEntity?: (name: string) => void
  density?: 'panel' | 'drawer'
}

/** Resolves a ranked row's click target and type metadata. */
const resolveRankedRowMeta = (
  result: SearchResult,
  entityIndex: Map<string, Entity>,
): { targetId: string | undefined; meta: EntityTypeMeta | undefined } => {
  const targetId = result.type === 'entity' ? result.id : result.entityId
  const resolvedEntity = targetId ? entityIndex.get(targetId) : undefined
  return { targetId, meta: resolvedEntity ? getEntityTypeMeta(resolvedEntity.type) : undefined }
}

/** Type dot + label badge for a ranked row. */
const RankedRowMetaBadge = ({ meta }: { meta: EntityTypeMeta | undefined }) => {
  if (!meta) return null
  return (
    <>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      <span className="rounded px-1.5 py-0 text-badge font-semibold uppercase tracking-wide text-ink-faint">
        {meta.label}
      </span>
    </>
  )
}

/** Single ranked search result row. */
const RankedResultRow = ({
  result,
  entityIndex,
  onStartEdit,
  onSelect,
}: {
  result: SearchResult
  entityIndex: Map<string, Entity>
  onStartEdit: (id: string) => void
  onSelect?: (id: string) => void
}) => {
  const { targetId, meta } = resolveRankedRowMeta(result, entityIndex)
  return (
    <li key={result.id}>
      <button
        onClick={() => {
          if (targetId) {
            onStartEdit(targetId)
            onSelect?.(targetId)
          }
        }}
        className="group block w-full min-h-[44px] rounded-md border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-ring"
        aria-label={`${result.name} — score ${result.score.toFixed(2)}`}
      >
        <div className="mb-1 flex items-center gap-2">
          <RankedRowMetaBadge meta={meta} />
          <span className="ml-auto text-caption tabular-nums text-ink-faint">
            {result.score.toFixed(1)}
          </span>
        </div>
        <div className="truncate text-[13px] font-medium text-ink">{result.name}</div>
        <p className="mt-0.5 line-clamp-2 text-label leading-snug text-ink-mute">
          {result.snippet}
        </p>
      </button>
    </li>
  )
}

/** Ranked result rows for EntitySearchPanel. */
const RankedResultList = ({
  results,
  entityIndex,
  onStartEdit,
  onSelect,
}: {
  results: SearchResult[]
  entityIndex: Map<string, Entity>
  onStartEdit: (id: string) => void
  onSelect?: (id: string) => void
}) => (
  <ul className="space-y-1.5" role="list" aria-label={translate('search.rankedResultsAriaLabel')}>
    {results.map((r) => (
      <RankedResultRow
        key={r.id}
        result={r}
        entityIndex={entityIndex}
        onStartEdit={onStartEdit}
        onSelect={onSelect}
      />
    ))}
  </ul>
)

/** Keyword result rows for EntitySearchPanel. */
const KeywordResultList = ({
  entities,
  onStartEdit,
  onSelect,
}: {
  entities: Entity[]
  onStartEdit: (id: string) => void
  onSelect?: (id: string) => void
}) => (
  <ul className="space-y-1.5" role="list" aria-label={translate('search.keywordResultsAriaLabel')}>
    {entities.slice(0, 20).map((e) => {
      const meta = getEntityTypeMeta(e.type)
      return (
        <li key={e.id}>
          <button
            onClick={() => {
              onStartEdit(e.id)
              onSelect?.(e.id)
            }}
            className="group block w-full min-h-[44px] rounded-md border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-ring"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
              <span className="rounded px-1.5 py-0 text-badge font-semibold uppercase tracking-wide text-ink-faint">
                {meta.label}
              </span>
            </div>
            <div className="truncate text-[13px] font-medium text-ink">{e.name}</div>
            <p className="mt-0.5 line-clamp-2 text-label leading-snug text-ink-mute">
              {e.description}
            </p>
          </button>
        </li>
      )
    })}
  </ul>
)

/** Empty state for EntitySearchPanel. */
const SearchEmptyState = ({
  query,
  onCreate,
}: {
  query: string
  onCreate?: (name: string) => void
}) => (
  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
    <FileText className="h-8 w-8 text-ink-faint/50" />
    <p className="text-[12px] text-ink-mute">
      {query ? translate('search.empty') : translate('search.libraryEmpty')}
    </p>
    {query && onCreate && (
      <button
        onClick={() => {
          onCreate(query)
        }}
        className="mt-2 flex min-h-[44px] items-center justify-center rounded-md border border-saffron/30 bg-saffron-soft px-3 py-1.5 text-[12px] font-medium text-saffron-deep transition-colors hover:bg-saffron/10 focus-ring"
      >
        {translate('search.createEntity', query)}
      </button>
    )}
  </div>
)

/** Shared entity search panel for desktop right-panel and mobile drawer. */
export const EntitySearchPanel = ({
  onSelect,
  onCreateEntity,
  density = 'panel',
}: EntitySearchPanelProps) => {
  const searchQuery = useStudioStore((s) => s.searchQuery)
  const setSearchQuery = useStudioStore((s) => s.setSearchQuery)
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const startEdit = useStudioStore((s) => s.startEdit)
  const [mode, setMode] = useState<'keyword' | 'ranked'>('keyword')
  const filtered = useFilteredEntities()
  const entityIndex = useMemo(() => buildEntityIndex(entities), [entities])
  const rankedResults = useMemo(
    () => (mode === 'ranked' ? search(entities, claims, searchQuery) : []),
    [mode, entities, claims, searchQuery],
  )

  const results = mode === 'ranked' ? rankedResults : filtered

  const horizontalPadding = density === 'panel' ? 'px-4' : 'px-3'

  return (
    <div className="flex flex-1 flex-col min-h-0 h-full">
      <div className={cn('border-b border-border pb-3', horizontalPadding)}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchQuery) {
                e.preventDefault()
                setSearchQuery('')
              }
            }}
            placeholder={translate('search.placeholder')}
            title={translate('search.ariaLabel')}
            aria-label={translate('search.ariaLabel')}
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-10 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={translate('search.clearAriaLabel')}
              title={translate('search.clearAriaLabel')}
              className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-1 rounded-md bg-muted p-0.5 text-label">
          <button
            onClick={() => {
              setMode('keyword')
            }}
            aria-pressed={mode === 'keyword'}
            className={cn(
              'flex flex-1 min-h-[44px] items-center justify-center rounded px-2 py-1 font-medium transition-colors focus-ring',
              mode === 'keyword' ? 'bg-background text-ink shadow-sm' : 'text-ink-mute',
            )}
          >
            {translate('search.keywordMode')}
          </button>
          <button
            onClick={() => {
              setMode('ranked')
            }}
            aria-pressed={mode === 'ranked'}
            className={cn(
              'flex flex-1 min-h-[44px] items-center justify-center rounded px-2 py-1 font-medium transition-colors focus-ring',
              mode === 'ranked' ? 'bg-background text-ink shadow-sm' : 'text-ink-mute',
            )}
          >
            {translate('search.rankedMode')}
          </button>
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {searchQuery.trim() ? translate('search.resultsCount', String(results.length)) : ''}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {results.length === 0 ? (
          <SearchEmptyState query={searchQuery} onCreate={onCreateEntity} />
        ) : mode === 'ranked' ? (
          <RankedResultList
            results={rankedResults}
            entityIndex={entityIndex}
            onStartEdit={startEdit}
            onSelect={onSelect}
          />
        ) : (
          <KeywordResultList
            entities={filtered}
            onStartEdit={startEdit}
            onSelect={onSelect}
          />
        )}
      </div>

      <div className={cn('border-t border-border py-2.5', horizontalPadding)}>
        <div className="flex items-center gap-1.5 text-label text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {translate('search.localSearchCount', String(entities.length))}
        </div>
      </div>
    </div>
  )
}
