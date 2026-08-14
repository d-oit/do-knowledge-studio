import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { ENTITY_TYPE_META, type Entity } from '@/lib/studio/types'
import { EntityIcon } from '../entity-type-icon'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

/** Module-scope date formatter for library timestamps (shared by grid and list). */
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

/** Formats an ISO timestamp as a short date (e.g. "Jun 15"). */
const formatDate = (iso: string): string => dateFormatter.format(new Date(iso))

/** Above this entity count the list/grid switches to windowed rendering (plans/122). */
const VIRTUALIZE_THRESHOLD = 64
/** Estimated table row height (px) before measurement. */
const TABLE_ROW_ESTIMATE_PX = 56
/** Estimated grid row height (px) before measurement. */
const GRID_ROW_ESTIMATE_PX = 150
/** Rows rendered above and below the visible window. */
const VIRTUAL_OVERSCAN = 8

/**
 * Whether to use windowed rendering. Requires a measurable container (real
 * browser layout) and a list large enough to justify it — jsdom tests stay on
 * the eager path since clientHeight is always 0 there.
 */
export const shouldVirtualize = (hasMeasurableHeight: boolean, count: number): boolean =>
  hasMeasurableHeight && count > VIRTUALIZE_THRESHOLD

/** Tracks whether the scroll container reports a real (non-zero) height. */
const useMeasurableHeight = (ref: RefObject<HTMLElement | null>): boolean => {
  const [hasHeight, setHasHeight] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => { setHasHeight(el.clientHeight > 0) }
    update()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update)
      observer.observe(el)
      return () => { observer.disconnect() }
    }
    return undefined
  }, [ref])
  return hasHeight
}

/** Tracks the responsive grid column count (1 / 2 / 3) matching the CSS breakpoints. */
const useColumnCount = (): number => {
  const [columns, setColumns] = useState(1)
  useLayoutEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mqTwo = window.matchMedia('(min-width: 640px)')
    const mqThree = window.matchMedia('(min-width: 1024px)')
    const update = () => { setColumns(mqThree.matches ? 3 : mqTwo.matches ? 2 : 1) }
    update()
    mqTwo.addEventListener('change', update)
    mqThree.addEventListener('change', update)
    return () => {
      mqTwo.removeEventListener('change', update)
      mqThree.removeEventListener('change', update)
    }
  }, [])
  return columns
}

/**
 * Windowed row state for a list/grid container.
 *
 * Isolates the @tanstack/react-virtual call so React Compiler skips only this
 * hook (the virtualizer returns un-memoizable functions by design) and the
 * calling components stay compiler-friendly.
 */
const useEntityListVirtualizer = (count: number, getScrollElement: () => HTMLDivElement | null, estimateSize: () => number) =>
  // tanstack/react-virtual returns un-memoizable functions by design, so React
  // Compiler skips this hook; isolating the call here keeps the consuming
  // components compiler-friendly (see plans/123).
  /* eslint-disable react-hooks/incompatible-library */
  useVirtualizer({
    count,
    getScrollElement,
    estimateSize,
    overscan: VIRTUAL_OVERSCAN,
  })
/* eslint-enable react-hooks/incompatible-library */

/** Splits items into fixed-size chunks (grid rows for virtualization). */
const chunkBy = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/** Scroll container shared by grid and list when windowed rendering is active. */
const SCROLL_CONTAINER_CLASS = 'max-h-[65vh] overflow-auto'

/** Grid of entity cards with staggered entrance animation. */
export function EntityGrid({
  entities,
  startEdit,
}: {
  entities: Entity[]
  startEdit: (id: string) => void
}) {
  const reducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const hasHeight = useMeasurableHeight(containerRef)
  const virtualize = shouldVirtualize(hasHeight, entities.length)
  const columns = useColumnCount()
  const rows = useMemo(() => chunkBy(entities, columns), [entities, columns])
  const virtualizer = useEntityListVirtualizer(
    rows.length,
    () => containerRef.current,
    () => GRID_ROW_ESTIMATE_PX,
  )

  const animate = !virtualize && !reducedMotion
  // Stable ref callback so React does not detach/reattach (and re-measure)
  // the row on every render.
  const measureRow = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) virtualizer.measureElement(node)
    },
    [virtualizer],
  )

  if (!virtualize) {
    return (
      <div ref={containerRef} className={SCROLL_CONTAINER_CLASS}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entities.map((e, i) => (
            <GridCard key={e.id} entity={e} startEdit={startEdit} index={i} animate={animate} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={SCROLL_CONTAINER_CLASS}>
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vi) => (
          <div
            key={vi.key}
            data-index={vi.index}
            ref={measureRow}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vi.start}px)`,
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {rows[vi.index].map((e) => (
              <GridCard key={e.id} entity={e} startEdit={startEdit} index={0} animate={false} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Single entity card (entrance animation only in the eager path). */
function GridCard({
  entity,
  startEdit,
  index,
  animate,
}: {
  entity: Entity
  startEdit: (id: string) => void
  index: number
  animate: boolean
}) {
  const meta = ENTITY_TYPE_META[entity.type]
  return (
    <motion.button
      initial={animate ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={animate ? { duration: 0.25, delay: Math.min(index * 0.03, 0.3) } : { duration: 0 }}
      onClick={() => { startEdit(entity.id) }}
      className="group flex flex-col rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-saffron/30 hover:shadow-md hover-lift focus-ring"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-md', meta.bg, meta.text)}>
          <EntityIcon type={entity.type} className="h-4 w-4" />
        </div>
        <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
          {meta.label}
        </span>
      </div>
      <h3 className="mb-1.5 font-serif text-[15px] font-semibold leading-snug text-ink group-hover:text-saffron-deep">
        {entity.name}
      </h3>
      <p className="line-clamp-3 flex-1 text-[12px] leading-relaxed text-ink-mute">
        {entity.description}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
        <div className="flex flex-wrap gap-1">
          {entity.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="rounded-full bg-muted px-1.5 py-0 text-badge font-medium text-ink-faint"
            >
              #{t}
            </span>
          ))}
          {entity.tags.length > 2 && (
            <span className="text-badge text-ink-faint">+{entity.tags.length - 2}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-caption text-ink-faint">
          <Clock className="h-2.5 w-2.5" />
          {formatDate(entity.updatedAt)}
        </div>
      </div>
    </motion.button>
  )
}

/** Table of entity rows for the library list view. */
export function EntityTable({
  entities,
  startEdit,
}: {
  entities: Entity[]
  startEdit: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasHeight = useMeasurableHeight(containerRef)
  const virtualize = shouldVirtualize(hasHeight, entities.length)
  const virtualizer = useEntityListVirtualizer(
    entities.length,
    () => containerRef.current,
    () => TABLE_ROW_ESTIMATE_PX,
  )
  // Stable ref callback so rows are not re-measured on every render.
  const measureRow = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (node) virtualizer.measureElement(node)
    },
    [virtualizer],
  )

  return (
    <div ref={containerRef} className={cn(SCROLL_CONTAINER_CLASS, 'rounded-lg border border-border bg-card')}>
      <table className="w-full">
        <caption className="sr-only">Library entities</caption>
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border bg-muted/30 text-left text-label font-semibold uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-2.5">Name</th>
            <th className="hidden px-4 py-2.5 sm:table-cell">Type</th>
            <th className="hidden px-4 py-2.5 lg:table-cell">Tags</th>
            <th className="px-4 py-2.5 text-right">Updated</th>
          </tr>
        </thead>
        <tbody
          style={
            virtualize ? { position: 'relative', height: virtualizer.getTotalSize() } : undefined
          }
        >
          {virtualize
            ? virtualizer.getVirtualItems().map((vi) => (
                <TableRow
                  key={entities[vi.index].id}
                  entity={entities[vi.index]}
                  startEdit={startEdit}
                  vi={vi}
                  measure={measureRow}
                />
              ))
            : entities.map((e) => (
                <TableRow key={e.id} entity={e} startEdit={startEdit} vi={null} />
              ))}
        </tbody>
      </table>
    </div>
  )
}

/** Single table row (absolutely positioned in the windowed path). */
function TableRow({
  entity,
  startEdit,
  vi,
  measure,
}: {
  entity: Entity
  startEdit: (id: string) => void
  vi: VirtualItem | null
  measure?: (node: HTMLTableRowElement | null) => void
}) {
  const meta = ENTITY_TYPE_META[entity.type]
  return (
    <tr
      key={entity.id}
      onClick={() => { startEdit(entity.id) }}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          startEdit(entity.id)
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open ${entity.name}`}
      data-index={vi?.index}
      ref={measure}
      style={
        vi
          ? {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vi.start}px)`,
            }
          : undefined
      }
      className="group cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/30 focus-ring"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded', meta.bg, meta.text)}>
            <EntityIcon type={entity.type} className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-ink group-hover:text-saffron-deep">
              {entity.name}
            </div>
            <div className="truncate text-label text-ink-mute">{entity.description}</div>
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
          {entity.tags.slice(0, 3).map((t) => (
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
        {formatDate(entity.updatedAt)}
      </td>
    </tr>
  )
}
