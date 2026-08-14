'use client'

import { useState, useCallback, useMemo } from 'react'
import { useStudioStore, useFilteredEntities } from '@/lib/studio/store'
import { ENTITY_TYPE_META, type EntityType, type Entity } from '@/lib/studio/types'
import { ToggleButtonGroup } from '../ui/shared-primitives'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FileText,
  Lightbulb,
  User,
  FolderKanban,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Clock,
  Search,
  X,
  SlidersHorizontal,
  Tag,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

/** Lucide icon mapping for each entity type. */
const TYPE_ICONS: Record<EntityType, typeof FileText> = {
  note: FileText,
  concept: Lightbulb,
  person: User,
  project: FolderKanban,
}

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
  const filteredEntities = useFilteredEntities()
  const reducedMotion = useReducedMotion()

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
              title="Clear search"
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
            title="Grid view"
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
            title="List view"
            aria-pressed={viewMode === 'list'}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </ToggleButtonGroup>

        <button
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
          aria-label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
          title={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
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
      <LibraryEmptyState
        allEntitiesLength={allEntities.length}
        filteredEntitiesLength={advancedFilteredEntities.length}
        startNew={startNew}
        clearFilters={clearFilters}
      />

      {/* Grid view */}
      {advancedFilteredEntities.length > 0 && viewMode === 'grid' && (
        <LibraryGridView
          entities={advancedFilteredEntities}
          reducedMotion={reducedMotion}
          startEdit={startEdit}
        />
      )}

      {/* List view */}
      {advancedFilteredEntities.length > 0 && viewMode === 'list' && (
        <LibraryListView
          entities={advancedFilteredEntities}
          startEdit={startEdit}
        />
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-label text-ink-faint">
          <ArrowUpDown className="h-3 w-3" />
          Showing {advancedFilteredEntities.length} {advancedFilteredEntities.length === 1 ? 'entity' : 'entities'}
        </div>
        <div className="sr-only" role="status" aria-live="polite">
          Showing {advancedFilteredEntities.length} {advancedFilteredEntities.length === 1 ? 'entity' : 'entities'}
        </div>
      </div>
    </div>
  )
}

/** Properties for the LibraryEmptyState component. */
interface LibraryEmptyStateProps {
  allEntitiesLength: number
  filteredEntitiesLength: number
  startNew: () => void
  clearFilters: () => void
}

/** Render empty states for library view. */
const LibraryEmptyState = ({
  allEntitiesLength,
  filteredEntitiesLength,
  startNew,
  clearFilters,
}: LibraryEmptyStateProps) => {
  if (allEntitiesLength === 0) {
    return (
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
    )
  }

  if (filteredEntitiesLength === 0) {
    return (
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
    )
  }

  return null
}

/** Properties for the LibraryGridView component. */
interface LibraryGridViewProps {
  entities: Entity[]
  reducedMotion: boolean
  startEdit: (id: string) => void
}

/** Render library entities in a responsive grid card layout. */
const LibraryGridView = ({ entities, reducedMotion, startEdit }: LibraryGridViewProps) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entities.map((e, i) => {
        const meta = ENTITY_TYPE_META[e.type]
        const Icon = TYPE_ICONS[e.type]
        return (
          <motion.button
            key={e.id}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
            onClick={() => startEdit(e.id)}
            className="group flex flex-col rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-saffron/30 hover:shadow-md hover-lift focus-ring"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-md', meta.bg, meta.text)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                {meta.label}
              </span>
            </div>
            <h3 className="mb-1.5 font-serif text-[15px] font-semibold leading-snug text-ink group-hover:text-saffron-deep">
              {e.name}
            </h3>
            <p className="line-clamp-3 flex-1 text-[12px] leading-relaxed text-ink-mute">
              {e.description}
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
              <div className="flex flex-wrap gap-1">
                {e.tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-muted px-1.5 py-0 text-badge font-medium text-ink-faint"
                  >
                    #{t}
                  </span>
                ))}
                {e.tags.length > 2 && (
                  <span className="text-badge text-ink-faint">+{e.tags.length - 2}</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-caption text-ink-faint">
                <Clock className="h-2.5 w-2.5" />
                {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(e.updatedAt))}
              </div>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

/** Properties for the LibraryListView component. */
interface LibraryListViewProps {
  entities: Entity[]
  startEdit: (id: string) => void
}

/** Render library entities in a structured list table layout. */
const LibraryListView = ({ entities, startEdit }: LibraryListViewProps) => {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full">
        <caption className="sr-only">Library entities</caption>
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-label font-semibold uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-2.5">Name</th>
            <th className="hidden px-4 py-2.5 sm:table-cell">Type</th>
            <th className="hidden px-4 py-2.5 lg:table-cell">Tags</th>
            <th className="px-4 py-2.5 text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => {
            const meta = ENTITY_TYPE_META[e.type]
            const Icon = TYPE_ICONS[e.type]
            return (
              <tr
                key={e.id}
                onClick={() => startEdit(e.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    startEdit(e.id)
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Open ${e.name}`}
                className="group cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/30 focus-ring"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded', meta.bg, meta.text)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-ink group-hover:text-saffron-deep">
                        {e.name}
                      </div>
                      <div className="truncate text-label text-ink-mute">{e.description}</div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className={cn('rounded-full px-2 py-0.5 text-caption font-medium', meta.bg, meta.text)}>
                    {meta.label}
                  </span>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {e.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted px-1.5 py-0 text-caption text-ink-faint"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-label text-ink-faint">
                  {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(e.updatedAt))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
