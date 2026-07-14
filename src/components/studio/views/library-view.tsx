'use client'

import { useState } from 'react'
import { useStudioStore, useFilteredEntities } from '@/lib/studio/store'
import { ENTITY_TYPE_META, type EntityType } from '@/lib/studio/types'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

const TYPE_ICONS: Record<EntityType, typeof FileText> = {
  note: FileText,
  concept: Lightbulb,
  person: User,
  project: FolderKanban,
}

const FILTERS: { id: EntityType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'note', label: 'Notes' },
  { id: 'concept', label: 'Concepts' },
  { id: 'person', label: 'People' },
  { id: 'project', label: 'Projects' },
]

export function LibraryView() {
  const {
    entities: allEntities,
    typeFilter,
    setTypeFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    startEdit,
    startNew,
    searchQuery,
    setSearchQuery,
    rightPanelOpen,
  } = useStudioStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const filteredEntities = useFilteredEntities()
  const reducedMotion = useReducedMotion()

  const clearFilters = () => {
    setSearchQuery('')
    setTypeFilter('all')
  }

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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink focus-ring rounded"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border p-0.5" role="group" aria-label="Filter by type">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              aria-pressed={typeFilter === f.id}
              className={cn(
                'rounded px-2.5 py-1 text-[12px] font-medium transition-colors focus-ring',
                typeFilter === f.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-ink-mute hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border p-0.5" role="group" aria-label="View mode">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded p-1.5 transition-colors focus-ring',
              viewMode === 'grid' ? 'bg-muted text-ink' : 'text-ink-faint hover:text-ink',
            )}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded p-1.5 transition-colors focus-ring',
              viewMode === 'list' ? 'bg-muted text-ink' : 'text-ink-faint hover:text-ink',
            )}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
          title="Toggle sort direction"
        >
          {sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        </button>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'created' | 'updated')}
          className="rounded-md border border-border bg-background px-2.5 py-2 text-[12px] font-medium text-ink-soft transition-colors focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
        >
          <option value="updated">Sort: Updated</option>
          <option value="created">Sort: Created</option>
          <option value="name">Sort: Name</option>
        </select>

        <button
          onClick={startNew}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
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
            className="mt-4 flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
          >
            <Plus className="h-4 w-4" />
            Create your first entity
          </button>
        </div>
      ) : filteredEntities.length === 0 ? (
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
            className="mt-4 flex items-center gap-1.5 rounded-md bg-secondary px-4 py-2 text-[13px] font-semibold text-ink transition-all hover:opacity-90 press-scale focus-ring"
          >
            <X className="h-4 w-4" />
            Clear all filters
          </button>
        </div>
      ) : null}

      {/* Grid view */}
      {filteredEntities.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntities.map((e, i) => {
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
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
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
                        className="rounded-full bg-muted px-1.5 py-0 text-[9px] font-medium text-ink-faint"
                      >
                        #{t}
                      </span>
                    ))}
                    {e.tags.length > 2 && (
                      <span className="text-[9px] text-ink-faint">+{e.tags.length - 2}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-ink-faint">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(e.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* List view */}
      {filteredEntities.length > 0 && viewMode === 'list' && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5">Name</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Type</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Tags</th>
                <th className="px-4 py-2.5 text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntities.map((e) => {
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
                          <div className="truncate text-[11px] text-ink-mute">{e.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', meta.bg, meta.text)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {e.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-muted px-1.5 py-0 text-[10px] text-ink-faint"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-ink-faint">
                      {new Date(e.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-ink-faint">
          <ArrowUpDown className="h-3 w-3" />
          Showing {filteredEntities.length} {filteredEntities.length === 1 ? 'entity' : 'entities'}
        </div>
        <div className="sr-only" role="status" aria-live="polite">
          Showing {filteredEntities.length} {filteredEntities.length === 1 ? 'entity' : 'entities'}
        </div>
      </div>
    </div>
  )
}
