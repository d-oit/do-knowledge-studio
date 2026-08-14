import { motion } from 'framer-motion'
import { Clock, FileText, Lightbulb, User, FolderKanban } from 'lucide-react'
import { ENTITY_TYPE_META, type Entity, type EntityType } from '@/lib/studio/types'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

/** Module-scope date formatter for library timestamps (shared by grid and list). */
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

/** Formats an ISO timestamp as a short date (e.g. "Jun 15"). */
const formatDate = (iso: string): string => dateFormatter.format(new Date(iso))

/** Entity-type icon rendered with the given classes (shared by grid and list). */
function EntityIcon({ type, className }: { type: EntityType; className?: string }) {
  switch (type) {
    case 'note':
      return <FileText className={className} />
    case 'concept':
      return <Lightbulb className={className} />
    case 'person':
      return <User className={className} />
    case 'project':
      return <FolderKanban className={className} />
  }
}

/** Grid of entity cards with staggered entrance animation. */
export function EntityGrid({
  entities,
  startEdit,
}: {
  entities: Entity[]
  startEdit: (id: string) => void
}) {
  const reducedMotion = useReducedMotion()

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entities.map((e, i) => {
        const meta = ENTITY_TYPE_META[e.type]
        return (
          <motion.button
            key={e.id}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
            onClick={() => { startEdit(e.id) }}
            className="group flex flex-col rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-saffron/30 hover:shadow-md hover-lift focus-ring"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-md', meta.bg, meta.text)}>
                <EntityIcon type={e.type} className="h-4 w-4" />
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
                {formatDate(e.updatedAt)}
              </div>
            </div>
          </motion.button>
        )
      })}
    </div>
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
            return (
              <tr
                key={e.id}
                onClick={() => { startEdit(e.id) }}
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
                      <EntityIcon type={e.type} className="h-3.5 w-3.5" />
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
                  {formatDate(e.updatedAt)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
