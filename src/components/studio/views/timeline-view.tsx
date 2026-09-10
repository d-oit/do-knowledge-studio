'use client'

import { memo, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { CalendarDays, Clock, FileText, Quote } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { getEntityTypeMeta } from '@/lib/studio/entity-types'
import { cn } from '@/lib/utils'
import { translate } from '@/lib/i18n/messages/timeline'
import { EntityIcon } from '../entity-type-icon'
import { buildTimelineGroups, type TimelineGroup, type TimelineItem } from './timeline-helpers'

/** Total number of markers inside a month band, used for the count badge. */
const monthItemCount = (group: TimelineGroup): number =>
  group.days.reduce((sum, day) => sum + day.items.length, 0)

/**
 * Single interactive timeline row — an entity or claim marker.
 * Pure presentational component with stable props (memoized).
 */
const TimelineRow = memo(function TimelineRow({
  item,
  onOpen,
}: {
  item: TimelineItem
  onOpen: (item: TimelineItem) => void
}) {
  const entityType = item.entityType
  const meta = entityType ? getEntityTypeMeta(entityType) : null
  return (
    <li>
      <button
        onClick={() => { onOpen(item) }}
        aria-label={translate('timeline.openItem', item.label)}
        className="group flex w-full items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:border-saffron/40 hover:bg-saffron-soft/40 focus-ring"
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            meta ? cn(meta.bg, meta.text) : 'bg-muted text-ink-faint',
          )}
        >
          {meta && entityType ? (
            <EntityIcon type={entityType} className="h-4 w-4" />
          ) : (
            <Quote className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink group-hover:text-saffron-deep">
            {item.label}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-label text-ink-faint">
          <Clock className="h-3 w-3" />
          {format(item.date, translate('timeline.timeFormat'))}
        </span>
        {meta ? (
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0 text-badge font-semibold uppercase tracking-wide',
              meta.bg,
              meta.text,
            )}
          >
            {meta.label}
          </span>
        ) : (
          <span className="shrink-0 rounded border border-border px-1.5 py-0 text-badge font-semibold uppercase tracking-wide text-ink-faint">
            {translate('timeline.claimBadge')}
          </span>
        )}
      </button>
    </li>
  )
})

/** Empty-state placeholder shown when nothing exists to plot on the timeline. */
const EmptyState = ({ onCreate }: { onCreate: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <CalendarDays className="h-10 w-10 text-ink-faint" />
      <div>
        <h2 className="font-serif text-lg font-semibold text-ink">
          {translate('timeline.empty.title')}
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-mute">
          {translate('timeline.empty.body')}
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
      >
        <FileText className="h-4 w-4" />
        {translate('timeline.empty.action')}
      </button>
    </div>
  )
}

/**
 * Temporal view (N2): entities and claims grouped into month bands with day
 * bands, newest first. Clicking a marker opens the owning entity in the
 * editor. Mobile-first, design tokens only, semantic list structure.
 */
export const TimelineView = () => {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const startEdit = useStudioStore((s) => s.startEdit)
  const startNew = useStudioStore((s) => s.startNew)

  const groups = useMemo(() => buildTimelineGroups(entities, claims), [entities, claims])

  const handleOpen = useCallback(
    (item: TimelineItem) => {
      const targetId = item.kind === 'claim' ? item.entityId : item.id
      if (!targetId) return
      // startEdit opens the target in the editor (sets editingEntityId and
      // the editor view) but only when the entity exists — an orphan claim
      // (no matching entity) stays on the timeline instead of landing on a
      // blank editor.
      startEdit(targetId)
    },
    [startEdit],
  )

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10 lg:py-12">
      <header className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-ink">{translate('timeline.title')}</h1>
        <p className="mt-1 text-[13px] text-ink-mute">{translate('timeline.subtitle')}</p>
      </header>

      {groups.length === 0 ? (
        <EmptyState onCreate={startNew} />
      ) : (
        <ol className="relative space-y-8 border-l border-border pl-5">
          {groups.map((group) => (
            <li key={group.month.toISOString()}>
              <h2 className="mb-3 flex flex-wrap items-baseline gap-2 font-serif text-lg font-semibold text-ink">
                {format(group.month, translate('timeline.monthFormat'))}
                <span className="font-sans text-badge font-semibold uppercase tracking-wide text-ink-faint">
                  {translate('timeline.itemCount', String(monthItemCount(group)))}
                </span>
              </h2>
              <ol className="space-y-3">
                {group.days.map((day) => (
                  <li key={day.day.toISOString()}>
                    <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                      {format(day.day, translate('timeline.dayFormat'))}
                    </h3>
                    <ol className="space-y-1.5">
                      {day.items.map((item) => (
                        <TimelineRow key={`${item.kind}-${item.id}`} item={item} onOpen={handleOpen} />
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}