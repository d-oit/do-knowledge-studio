'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, History, RotateCcw } from 'lucide-react'
import type { Entity } from '@/lib/studio/types'
import { diffEntitySnapshots } from '@/lib/studio/revision-diff'
import { summarizeRevisionUsage, type EntityRevision } from '@/lib/studio/revision-model'
import { listEntityRevisions } from '@/lib/studio/revision-storage'
import { formatBytes } from '@/lib/studio/storage-report'
import { translate } from '@/lib/i18n/messages/revisions'

/** Locale-aware capture timestamp shown on each revision row. */
const REVISION_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Message key for a capture reason badge. */
const REASON_LABEL = {
  save: 'revisions.reason.save',
  merge: 'revisions.reason.merge',
  import: 'revisions.reason.import',
  restore: 'revisions.reason.restore',
} as const

/** One line of the body diff, styled by direction. */
const RevisionDiffLine = ({ kind, text }: { kind: 'same' | 'added' | 'removed'; text: string }) => {
  const tone =
    kind === 'added'
      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
      : kind === 'removed'
        ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
        : 'text-ink-mute'
  const marker = kind === 'added' ? '+' : kind === 'removed' ? '−' : ' '
  return (
    <div className={`whitespace-pre-wrap break-words px-2 py-0.5 ${tone}`}>
      <span aria-hidden="true" className="mr-2 select-none font-mono text-ink-faint">
        {marker}
      </span>
      {text}
    </div>
  )
}

/**
 * Durable per-entity revision history (#1060): lists stored versions, diffs the
 * selected one against the note as it is now, and restores through the store so
 * the restore itself lands in undo/redo.
 */
export const EntityRevisionsPanel = ({
  entity,
  onRestore,
}: {
  entity: Entity
  onRestore: (snapshot: Entity) => void
}) => {
  const [revisions, setRevisions] = useState<EntityRevision[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // Reload whenever the entity changes or is written: a new save adds a
  // revision, and the diff is always against the CURRENT note.
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    listEntityRevisions(entity.id)
      .then((records) => {
        if (cancelled) return
        setRevisions(records)
        setSelectedId(records[0]?.id ?? null)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Failed to load entity revisions', error)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [entity.id, entity.updatedAt])

  const usage = useMemo(() => summarizeRevisionUsage(revisions), [revisions])
  const selected = useMemo(
    () => revisions.find((revision) => revision.id === selectedId) ?? null,
    [revisions, selectedId],
  )
  const diff = useMemo(
    () => (selected ? diffEntitySnapshots(selected.entity, entity) : null),
    [selected, entity],
  )

  return (
    <section className="mt-8 rounded-lg border border-border bg-surface p-4" aria-labelledby="revisions-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="revisions-heading" className="flex items-center gap-2 font-serif text-heading-sm text-ink">
          <History className="h-4 w-4 text-saffron" aria-hidden="true" />
          {translate('revisions.title')}
        </h2>
        {status === 'ready' && (
          <span className="font-mono text-caption text-ink-faint">
            {translate('revisions.usage', String(usage.count), formatBytes(usage.bytes))}
          </span>
        )}
      </div>

      {status === 'loading' && (
        // Deliberately not a live region: the editor already owns the page's
        // status announcement (#856), and a second one would be read on every
        // open. The list itself follows within the same interaction.
        <p className="mt-3 text-label text-ink-faint">{translate('revisions.loading')}</p>
      )}

      {status === 'error' && (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-label text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {translate('revisions.error')}
        </p>
      )}

      {status === 'ready' && revisions.length === 0 && (
        <p className="mt-3 text-label leading-relaxed text-ink-faint">{translate('revisions.empty')}</p>
      )}

      {status === 'ready' && revisions.length > 0 && (
        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <p className="mb-1 text-caption uppercase tracking-wide text-ink-faint">
              {translate('revisions.selectLabel')}
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto" role="list">
              {revisions.map((revision) => {
                const isSelected = revision.id === selectedId
                const when = REVISION_TIME_FORMAT.format(new Date(revision.createdAt))
                return (
                  <li key={revision.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(revision.id)
                      }}
                      aria-pressed={isSelected}
                      className={`flex min-h-touch w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-label transition-colors focus-ring ${
                        isSelected
                          ? 'border-saffron bg-saffron-soft text-ink'
                          : 'border-border bg-background text-ink-mute hover:bg-muted'
                      }`}
                    >
                      <span>{when}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-caption text-ink-faint">
                        {translate(REASON_LABEL[revision.reason])}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-caption uppercase tracking-wide text-ink-faint">
              {translate('revisions.diffTitle')}
            </h3>
            {diff && diff.fields.length === 0 && diff.lines.every((line) => line.kind === 'same') ? (
              <p className="mt-2 text-label text-ink-faint">{translate('revisions.noDiff')}</p>
            ) : (
              diff && (
                <div className="mt-2 space-y-2">
                  {diff.fields.length > 0 && (
                    <dl className="space-y-1 text-label">
                      {diff.fields.map((change) => (
                        <div key={change.field}>
                          <dt className="inline font-medium text-ink-mute">{change.field}: </dt>
                          <dd className="inline text-ink">
                            <span className="text-red-700 dark:text-red-300">{change.before || '—'}</span>
                            {' → '}
                            <span className="text-emerald-700 dark:text-emerald-300">{change.after || '—'}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-background font-mono text-caption leading-relaxed">
                    {diff.lines.map((line, index) => (
                      <RevisionDiffLine key={`${line.kind}-${index}`} kind={line.kind} text={line.text} />
                    ))}
                  </div>
                  {diff.truncated && (
                    <p className="text-caption text-ink-faint">{translate('revisions.truncated')}</p>
                  )}
                </div>
              )
            )}
            {selected && (
              <button
                type="button"
                onClick={() => {
                  onRestore(selected.entity)
                }}
                className="mt-3 flex min-h-touch items-center gap-1.5 rounded-md bg-saffron px-3 py-1.5 text-label font-medium text-white transition-colors hover:bg-saffron-deep focus-ring"
                aria-label={translate(
                  'revisions.restoreAria',
                  REVISION_TIME_FORMAT.format(new Date(selected.createdAt)),
                )}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {translate('revisions.restore')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
