'use client'

import { useState, useCallback, useMemo } from 'react'
import { useStudioStore, useFilteredEntities } from '@/lib/studio/store'
import { type EntityType } from '@/lib/studio/types'
import { ToggleButtonGroup } from '../ui/shared-primitives'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FileText,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Search,
  X,
  SlidersHorizontal,
  Tag,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EntityGrid, EntityTable } from './library-entities'

/** Entity type filter options including the "all" sentinel. */
const FILTERS: { id: EntityType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'note', label: 'Notes' },
  { id: 'concept', label: 'Concepts' },
  { id: 'person', label: 'People' },
  { id: 'project', label: 'Projects' },
]

/** Label for the advanced filters disclosure toggle. */
const ADVANCED_FILTERS_LABEL = 'Advanced filters'
/** Helper text shown inside the advanced filters panel. */
const ADVANCED_FILTERS_HINT = 'Narrow results with type-specific options'
/** Label for the tag filter input. */
const TAG_FILTER_LABEL = 'Tag contains'
/** Placeholder text for the tag filter input. */
const TAG_FILTER_PLACEHOLDER = 'e.g. research'
/** Checkbox label for filtering to entities with descriptions. */
const HAS_DESCRIPTION_LABEL = 'Only show entities with a description'
/** Button label to clear only the advanced filter values. */
const CLEAR_ADVANCED_LABEL = 'Clear advanced filters'
/** Initial number of entities rendered before the "Show all" expansion (large-list cap). */
const LIBRARY_INITIAL_LIMIT = 24
/** Label for the button that expands the entity list beyond the initial cap. */
const showAllLabel = (total: number): string => `Show all ${total} entities`
/** Label for the button that collapses the expanded entity list. */
const SHOW_FEWER_LABEL = 'Show fewer'

/** Entity library view with grid/list layout, search, type filters, and sort controls. */
export const LibraryView = () => {
  const allEntities = useStudioStore((s) => s.entities)
  const typeFilter = useStudioStore((s) => s.typeFilter)
  const setTypeFilter = useStudioStore((s) => s.setTypeFilter)
  const sortBy = useStudioStore((s) => s.sortBy)
  const setSortBy = useStudioStore((s) => s.setSortBy)
  const sortDir = useStudioStore((s) => s.sortDir)
  const setSortDir = useStudioStore((s) => s.setSortDir)
  const startEdit = useStudioStore((s) => s.startEdit)
  const startNew = useStudioStore((s) => s.startNew)
  const searchQuery = useStudioStore((s) => s.searchQuery)
  const setSearchQuery = useStudioStore((s) => s.setSearchQuery)
  const rightPanelOpen = useStudioStore((s) => s.rightPanelOpen)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const [hasDescriptionOnly, setHasDescriptionOnly] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const filteredEntities = useFilteredEntities()

  const advancedFilteredEntities = useMemo(() => {
    const tag = tagQuery.trim().toLowerCase()
    if (!tag && !hasDescriptionOnly) return filteredEntities
    return filteredEntities.filter((e) => {
      if (tag && !e.tags.some((t) => t.toLowerCase().includes(tag))) return false
      if (hasDescriptionOnly && !e.description.trim()) return false
      return true
    })
  }, [filteredEntities, tagQuery, hasDescriptionOnly])

  const hasAdvancedFilters = tagQuery.trim().length > 0 || hasDescriptionOnly

  // Large-list guard: render only the first LIBRARY_INITIAL_LIMIT entities by
  // default and let the user expand with "Show all" (plans/122).
  const isCapped = advancedFilteredEntities.length > LIBRARY_INITIAL_LIMIT
  const visibleEntities =
    showAll || !isCapped
      ? advancedFilteredEntities
      : advancedFilteredEntities.slice(0, LIBRARY_INITIAL_LIMIT)

  /** Resets all filter and search state to defaults. */
  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setTypeFilter('all')
    setTagQuery('')
    setHasDescriptionOnly(false)
  }, [setSearchQuery, setTypeFilter])

  /** Clears only the advanced filter values (tag query and description toggle). */
  const clearAdvancedFilters = useCallback(() => {
    setTagQuery('')
    setHasDescriptionOnly(false)
  }, [])

  return (
    <div className={cn('mx-auto px-6 py-6 lg:px-10 lg:py-8', rightPanelOpen ? 'max-w-5xl' : 'max-w-6xl')}>
      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name, description, or tag…"
            aria-label="Search library"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-10 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 min-h-[44px] min-w-[44px] -translate-y-1/2 flex items-center justify-center text-ink-faint hover:text-ink focus-ring rounded"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <ToggleButtonGroup label="Filter by type">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              aria-pressed={typeFilter === f.id}
              className={cn(
                'rounded min-h-[44px] min-w-[44px] px-2.5 text-[12px] font-medium transition-colors focus-ring',
                typeFilter === f.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-ink-mute hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </ToggleButtonGroup>

        <ToggleButtonGroup label="View mode">
          <button
            onClick={() => { setViewMode('grid') }}
            className={cn(
              'rounded min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 transition-colors focus-ring',
              viewMode === 'grid' ? 'bg-muted text-ink' : 'text-ink-faint hover:text-ink',
            )}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setViewMode('list') }}
            className={cn(
              'rounded min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 transition-colors focus-ring',
              viewMode === 'list' ? 'bg-muted text-ink' : 'text-ink-faint hover:text-ink',
            )}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </ToggleButtonGroup>

        <button
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
          aria-label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
        >
          {sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        </button>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'created' | 'updated')}
          aria-label="Sort by"
          className="rounded-md border border-border bg-background px-2.5 py-2 text-[12px] font-medium text-ink-soft transition-colors focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
        >
          <option value="updated">Sort: Updated</option>
          <option value="created">Sort: Created</option>
          <option value="name">Sort: Name</option>
        </select>

        <button
          onClick={startNew}
          className="flex min-h-[44px] items-center gap-1 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {/* Advanced filters disclosure */}
      <div className="mb-4">
        <button
          onClick={() => { setAdvancedOpen(!advancedOpen) }}
          aria-expanded={advancedOpen}
          aria-controls="library-advanced-filters"
          className={cn(
            'flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors focus-ring',
            hasAdvancedFilters
              ? 'border-saffron/40 bg-saffron-soft/40 text-saffron-deep'
              : 'border-border bg-background text-ink-soft hover:border-saffron/40',
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {ADVANCED_FILTERS_LABEL}
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', advancedOpen && 'rotate-180')}
            aria-hidden="true"
          />
          {hasAdvancedFilters && (
            <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-saffron px-1 text-badge font-bold text-white">
              {Number(hasDescriptionOnly) + (tagQuery.trim() ? 1 : 0)}
            </span>
          )}
        </button>

        {advancedOpen && (
          <div
            id="library-advanced-filters"
            className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/60 p-3"
          >
            <div className="w-full max-w-xs sm:w-56">
              <label
                htmlFor="library-tag-filter"
                className="mb-1 flex items-center gap-1 text-label font-semibold uppercase tracking-wide text-ink-faint"
              >
                <Tag className="h-3 w-3" aria-hidden="true" />
                {TAG_FILTER_LABEL}
              </label>
              <input
                id="library-tag-filter"
                type="text"
                value={tagQuery}
                onChange={(e) => { setTagQuery(e.target.value) }}
                placeholder={TAG_FILTER_PLACEHOLDER}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
              />
            </div>

            <div className="flex min-h-[44px] items-center">
              <label
                htmlFor="library-desc-only"
                className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
              >
                <Checkbox
                  id="library-desc-only"
                  checked={hasDescriptionOnly}
                  onCheckedChange={(checked) => { setHasDescriptionOnly(Boolean(checked)) }}
                />
                {HAS_DESCRIPTION_LABEL}
              </label>
            </div>

            {hasAdvancedFilters && (
              <button
                onClick={clearAdvancedFilters}
                className="flex min-h-[44px] items-center gap-1 rounded-md px-2 text-[12px] font-medium text-ink-faint transition-colors hover:text-ink focus-ring"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                {CLEAR_ADVANCED_LABEL}
              </button>
            )}
            <p className="w-full text-caption text-ink-faint">{ADVANCED_FILTERS_HINT}</p>
          </div>
        )}
      </div>

      {/* Empty states */}
      {allEntities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-saffron-soft">
            <FileText className="h-6 w-6 text-saffron" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-ink">No entities yet</h3>
          <p className="mt-1 max-w-sm text-[13px] text-ink-mute">
            Capture your first thought, concept, person, or project. Everything you save stays local
            and offline-ready.
          </p>
          <button
            onClick={startNew}
            className="mt-4 flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
          >
            <Plus className="h-4 w-4" />
            Create your first entity
          </button>
        </div>
      ) : advancedFilteredEntities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Search className="h-6 w-6 text-ink-faint" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-ink">No matches found</h3>
          <p className="mt-1 max-w-sm text-[13px] text-ink-mute">
            Try adjusting your search terms or filters to find what you&apos;re looking for.
          </p>
          <button
            onClick={clearFilters}
            className="mt-4 flex min-h-[44px] items-center gap-1.5 rounded-md bg-secondary px-4 text-[13px] font-semibold text-ink transition-all hover:opacity-90 press-scale focus-ring"
          >
            <X className="h-4 w-4" />
            Clear all filters
          </button>
        </div>
      ) : null}

      {/* Grid view */}
      {visibleEntities.length > 0 && viewMode === 'grid' && (
        <EntityGrid entities={visibleEntities} startEdit={startEdit} />
      )}

      {/* List view */}
      {visibleEntities.length > 0 && viewMode === 'list' && (
        <EntityTable entities={visibleEntities} startEdit={startEdit} />
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-label text-ink-faint">
          <ArrowUpDown className="h-3 w-3" />
          {isCapped
            ? `Showing ${visibleEntities.length} of ${advancedFilteredEntities.length} entities`
            : `Showing ${visibleEntities.length} ${visibleEntities.length === 1 ? 'entity' : 'entities'}`}
        </div>
        <div className="sr-only" role="status" aria-live="polite">
          {isCapped
            ? `Showing ${visibleEntities.length} of ${advancedFilteredEntities.length} entities`
            : `Showing ${visibleEntities.length} ${visibleEntities.length === 1 ? 'entity' : 'entities'}`}
        </div>
        {isCapped && (
          <button
            onClick={() => { setShowAll(!showAll) }}
            className="flex min-h-[44px] items-center gap-1 rounded-md border border-border bg-background px-3 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 hover:text-ink focus-ring"
            aria-expanded={showAll}
          >
            {showAll ? SHOW_FEWER_LABEL : showAllLabel(advancedFilteredEntities.length)}
          </button>
        )}
      </div>
    </div>
  )
}
