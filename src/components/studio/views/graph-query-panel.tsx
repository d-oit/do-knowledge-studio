'use client'

import { useMemo, useState } from 'react'
import { Filter, Route, BookmarkPlus, Trash2, Play } from 'lucide-react'
import type { Claim, Entity } from '@/lib/studio/types'
import {
  EMPTY_GRAPH_FILTER,
  countActiveFilterFacets,
  findShortestPath,
  isGraphFilterActive,
  pathNodeNames,
  type GraphFilter,
  type GraphPathResult,
} from '@/lib/studio/graph-query'
import {
  GRAPH_VIEW_NAME_MAX_LENGTH,
  MAX_SAVED_GRAPH_VIEWS,
  buildSavedGraphView,
  normalizeGraphViewName,
  type SavedGraphView,
  type SavedGraphViewInput,
} from '@/lib/studio/graph-views'
import { getEntityTypeDefs } from '@/lib/studio/entity-types'
import { translate } from '@/lib/i18n/messages/graph'
import { cn } from '@/lib/utils'

/** Input class shared by the text and date fields in this panel. */
const FIELD_CLASS =
  'min-h-touch rounded-md border border-border bg-background px-2 py-1 text-label text-ink focus-ring'

/** Checkbox + label row. */
const CheckRow = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) => (
  <label className="flex min-h-touch cursor-pointer items-center gap-2 text-label text-ink-soft">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        onChange(e.target.checked)
      }}
      className="h-4 w-4 accent-saffron focus-ring"
    />
    {label}
  </label>
)

/** Splits a comma-separated field into trimmed, non-empty values. */
const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

/** Joins a list for display in a comma-separated field. */
const joinList = (values: string[]): string => values.join(', ')

/** Filtering, path finding, and saved-view controls for the graph canvas. */
export const GraphQueryPanel = ({
  entities,
  claims,
  filter,
  onFilterChange,
  pathResult,
  onPathResult,
  views,
  onSaveView,
  onApplyView,
  onDeleteView,
  currentView,
}: {
  entities: Entity[]
  claims: Claim[]
  filter: GraphFilter
  onFilterChange: (next: GraphFilter) => void
  pathResult: GraphPathResult | null
  onPathResult: (result: GraphPathResult | null) => void
  views: SavedGraphView[]
  onSaveView: (view: SavedGraphView) => void
  onApplyView: (view: SavedGraphView) => void
  onDeleteView: (id: string) => void
  currentView: SavedGraphViewInput
}) => {
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [viewName, setViewName] = useState('')

  const sortedEntities = useMemo(
    () => [...entities].sort((a, b) => a.name.localeCompare(b.name)),
    [entities],
  )
  const typeDefs = getEntityTypeDefs()
  const activeFacets = countActiveFilterFacets(filter)
  const knownIds = useMemo(() => new Set(entities.map((entity) => entity.id)), [entities])

  const pathHopLines = useMemo(() => {
    if (!pathResult?.found) return []
    return pathResult.edges.map((edge, index) =>
      translate('graph.queries.path.hop', String(index + 1), edge.relation),
    )
  }, [pathResult])

  const pathNames = useMemo(() => {
    if (!pathResult?.found) return []
    return pathNodeNames(entities, pathResult.nodeIds)
  }, [entities, pathResult])

  const toggleType = (typeId: string, checked: boolean) => {
    onFilterChange({
      ...filter,
      types: checked ? [...filter.types, typeId] : filter.types.filter((t) => t !== typeId),
    })
  }

  const canSave = normalizeGraphViewName(viewName).length > 0

  return (
    <section
      aria-labelledby="graph-queries-heading"
      className="border-b border-border bg-card/40 px-5 py-3"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id="graph-queries-heading" className="font-serif text-body font-semibold text-ink">
          {translate('graph.queries.heading')}
        </h2>
        <span className="text-label text-ink-faint" aria-live="polite">
          {isGraphFilterActive(filter)
            ? translate('graph.queries.filters.active', String(activeFacets))
            : translate('graph.queries.filters.none')}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Filters */}
        <fieldset className="rounded-md border border-border p-3">
          <legend className="flex items-center gap-1.5 px-1 text-label font-semibold text-ink">
            <Filter className="h-3 w-3" aria-hidden="true" />
            {translate('graph.queries.filters.legend')}
          </legend>
          <div className="space-y-2">
            <fieldset>
              <legend className="mb-1 text-label font-medium text-ink-soft">
                {translate('graph.queries.filters.types')}
              </legend>
              <div className="flex flex-wrap gap-x-3">
                {typeDefs.map((def) => (
                  <CheckRow
                    key={def.id}
                    checked={filter.types.includes(def.id)}
                    onChange={(checked) => {
                      toggleType(def.id, checked)
                    }}
                    label={def.label}
                  />
                ))}
              </div>
            </fieldset>

            <label className="block text-label text-ink-soft">
              {translate('graph.queries.filters.tags')}
              <input
                type="text"
                value={joinList(filter.tags)}
                onChange={(e) => {
                  onFilterChange({ ...filter, tags: splitList(e.target.value) })
                }}
                className={cn(FIELD_CLASS, 'mt-1 w-full')}
              />
            </label>

            <label className="block text-label text-ink-soft">
              {translate('graph.queries.filters.relations')}
              <input
                type="text"
                value={joinList(filter.relations)}
                onChange={(e) => {
                  onFilterChange({ ...filter, relations: splitList(e.target.value) })
                }}
                className={cn(FIELD_CLASS, 'mt-1 w-full')}
              />
            </label>

            <CheckRow
              checked={filter.verifiedOnly}
              onChange={(checked) => {
                onFilterChange({ ...filter, verifiedOnly: checked })
              }}
              label={translate('graph.queries.filters.verifiedOnly')}
            />

            <label className="block text-label text-ink-soft">
              {translate(
                'graph.queries.filters.minConfidence',
                String(Math.round(filter.minConfidence * 100)),
              )}
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={filter.minConfidence}
                onChange={(e) => {
                  onFilterChange({ ...filter, minConfidence: Number(e.target.value) })
                }}
                className="mt-1 w-full accent-saffron"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <label className="flex-1 text-label text-ink-soft">
                {translate('graph.queries.filters.updatedAfter')}
                <input
                  type="date"
                  value={filter.updatedAfter ?? ''}
                  onChange={(e) => {
                    onFilterChange({ ...filter, updatedAfter: e.target.value || null })
                  }}
                  className={cn(FIELD_CLASS, 'mt-1 w-full')}
                />
              </label>
              <label className="flex-1 text-label text-ink-soft">
                {translate('graph.queries.filters.updatedBefore')}
                <input
                  type="date"
                  value={filter.updatedBefore ?? ''}
                  onChange={(e) => {
                    onFilterChange({ ...filter, updatedBefore: e.target.value || null })
                  }}
                  className={cn(FIELD_CLASS, 'mt-1 w-full')}
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                onFilterChange(EMPTY_GRAPH_FILTER)
              }}
              disabled={!isGraphFilterActive(filter)}
              className="min-h-touch rounded px-2 text-label font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring disabled:opacity-50"
            >
              {translate('graph.queries.filters.clear')}
            </button>
            <p className="text-caption text-ink-faint">
              {translate('graph.queries.filters.counts', String(entities.length), String(claims.length))}
            </p>
          </div>
        </fieldset>

        {/* Path query */}
        <fieldset className="rounded-md border border-border p-3">
          <legend className="flex items-center gap-1.5 px-1 text-label font-semibold text-ink">
            <Route className="h-3 w-3" aria-hidden="true" />
            {translate('graph.queries.path.legend')}
          </legend>
          <div className="space-y-2">
            <label className="block text-label text-ink-soft">
              {translate('graph.queries.path.from')}
              <select
                aria-label={translate('graph.queries.path.from')}
                value={fromId}
                onChange={(e) => {
                  setFromId(e.target.value)
                }}
                className={cn(FIELD_CLASS, 'mt-1 w-full')}
              >
                <option value="">—</option>
                {sortedEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-label text-ink-soft">
              {translate('graph.queries.path.to')}
              <select
                aria-label={translate('graph.queries.path.to')}
                value={toId}
                onChange={(e) => {
                  setToId(e.target.value)
                }}
                className={cn(FIELD_CLASS, 'mt-1 w-full')}
              >
                <option value="">—</option>
                {sortedEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onPathResult(
                    fromId && toId && knownIds.has(fromId) && knownIds.has(toId)
                      ? findShortestPath(entities, fromId, toId)
                      : null,
                  )
                }}
                disabled={!fromId || !toId}
                className="flex min-h-touch items-center gap-1 rounded bg-primary px-3 text-label font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-ring disabled:opacity-50"
              >
                <Play className="h-3 w-3" aria-hidden="true" />
                {translate('graph.queries.path.find')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onPathResult(null)
                }}
                disabled={pathResult === null}
                className="min-h-touch rounded px-2 text-label font-medium text-ink-mute transition-colors hover:text-ink focus-ring disabled:opacity-50"
              >
                {translate('graph.queries.path.clear')}
              </button>
            </div>

            <div aria-live="polite" className="text-label text-ink-soft">
              {pathResult === null && <p>{translate('graph.queries.path.missing')}</p>}
              {pathResult !== null && !pathResult.found && (
                <p>
                  {pathResult.reason === 'unknown-entity'
                    ? translate('graph.queries.path.unknown')
                    : translate('graph.queries.path.noPath')}
                </p>
              )}
              {pathResult?.found && (
                <>
                  <p className="font-medium text-ink">
                    {translate('graph.queries.path.summary', String(pathResult.edges.length))}
                  </p>
                  <p>{pathNames.join(' → ')}</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                    {pathHopLines.map((line, index) => (
                      <li key={`${index}-${line}`}>{line}</li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </div>
        </fieldset>

        {/* Saved views */}
        <fieldset className="rounded-md border border-border p-3">
          <legend className="flex items-center gap-1.5 px-1 text-label font-semibold text-ink">
            <BookmarkPlus className="h-3 w-3" aria-hidden="true" />
            {translate('graph.queries.views.legend')}
          </legend>
          <div className="space-y-2">
            <label className="block text-label text-ink-soft">
              {translate('graph.queries.views.name')}
              <input
                type="text"
                aria-label={translate('graph.queries.views.name')}
                value={viewName}
                maxLength={GRAPH_VIEW_NAME_MAX_LENGTH}
                onChange={(e) => {
                  setViewName(e.target.value)
                }}
                className={cn(FIELD_CLASS, 'mt-1 w-full')}
              />
            </label>
            <button
              type="button"
              disabled={!canSave || views.length >= MAX_SAVED_GRAPH_VIEWS}
              onClick={() => {
                onSaveView(buildSavedGraphView({ ...currentView, name: viewName }))
                setViewName('')
              }}
              className="min-h-touch rounded bg-primary px-3 text-label font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-ring disabled:opacity-50"
            >
              {translate('graph.queries.views.save')}
            </button>
            <p className="text-caption text-ink-faint">
              {translate('graph.queries.views.limit', String(MAX_SAVED_GRAPH_VIEWS))}
            </p>

            {views.length === 0 ? (
              <p className="text-label text-ink-faint">{translate('graph.queries.views.empty')}</p>
            ) : (
              <ul className="space-y-1">
                {views.map((view) => (
                  <li key={view.id} className="flex items-center gap-1">
                    <span className="flex-1 truncate text-label text-ink-soft" title={view.name}>
                      {view.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyView(view)
                      }}
                      className="min-h-touch rounded px-2 text-label font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring"
                    >
                      {translate('graph.queries.views.apply')}
                    </button>
                    <button
                      type="button"
                      aria-label={translate('graph.queries.views.deleteAria', view.name)}
                      onClick={() => {
                        onDeleteView(view.id)
                      }}
                      className="flex min-h-touch min-w-touch items-center justify-center rounded text-ink-faint transition-colors hover:text-ink focus-ring"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </fieldset>
      </div>
    </section>
  )
}
