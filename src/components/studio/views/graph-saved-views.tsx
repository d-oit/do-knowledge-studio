'use client'

import { useState } from 'react'
import { BookmarkPlus, Trash2 } from 'lucide-react'
import {
  GRAPH_VIEW_NAME_MAX_LENGTH,
  MAX_SAVED_GRAPH_VIEWS,
  buildSavedGraphView,
  normalizeGraphViewName,
  type SavedGraphView,
  type SavedGraphViewInput,
} from '@/lib/studio/graph-views'
import { EMPTY_GRAPH_QUERY, isGraphQueryEmpty, validateGraphQuery } from '@/lib/studio/graph-query-builder'
import { translate } from '@/lib/i18n/messages/graph'
import { cn } from '@/lib/utils'

const FIELD_CLASS =
  'min-h-touch rounded-md border border-border bg-background px-2 py-1 text-label text-ink focus-ring'

/** Drops the store metadata a builder derives, leaving the user input shape. */
const withoutMeta = ({ id: _id, createdAt: _createdAt, ...input }: SavedGraphView): SavedGraphViewInput =>
  input

/** Saved-view card: save, apply, rename, duplicate, and delete named views. */
export const GraphSavedViews = ({
  views,
  currentView,
  onSaveView,
  onApplyView,
  onDeleteView,
}: {
  views: SavedGraphView[]
  currentView: SavedGraphViewInput
  onSaveView: (view: SavedGraphView) => void
  onApplyView: (view: SavedGraphView) => void
  onDeleteView: (id: string) => void
}) => {
  const [viewName, setViewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  // An invalid query must never be persisted: hydration validates saved views,
  // so a rejected view would fail the whole envelope load. Save stays disabled
  // (with an explanation) until the query is valid or empty.
  const activeQuery = currentView.query ?? EMPTY_GRAPH_QUERY
  const queryInvalid = !isGraphQueryEmpty(activeQuery) && validateGraphQuery(activeQuery).length > 0
  const canSave = normalizeGraphViewName(viewName).length > 0 && !queryInvalid

  const startRename = (view: SavedGraphView) => {
    setRenamingId(view.id)
    setRenameDraft(view.name)
  }
  const commitRename = (view: SavedGraphView) => {
    const normalized = normalizeGraphViewName(renameDraft)
    if (normalized.length === 0) return
    onSaveView(
      buildSavedGraphView(
        { ...withoutMeta(view), name: normalized },
        { id: view.id, createdAt: view.createdAt },
      ),
    )
    setRenamingId(null)
  }
  const duplicate = (view: SavedGraphView) => {
    onSaveView(
      buildSavedGraphView({
        ...withoutMeta(view),
        name: translate('graph.queries.views.duplicateName', view.name),
      }),
    )
  }

  return (
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
        {queryInvalid && (
          <p className="text-caption text-ink-soft">
            {translate('graph.builder.preview.invalid')}
          </p>
        )}
        <p className="text-caption text-ink-faint">
          {translate('graph.queries.views.limit', String(MAX_SAVED_GRAPH_VIEWS))}
        </p>

        {views.length === 0 ? (
          <p className="text-label text-ink-faint">{translate('graph.queries.views.empty')}</p>
        ) : (
          <ul className="space-y-1">
            {views.map((view) => (
              <li key={view.id} className="flex flex-wrap items-center gap-1">
                {renamingId === view.id ? (
                  <>
                    <input
                      type="text"
                      aria-label={translate('graph.queries.views.renameAria', view.name)}
                      value={renameDraft}
                      maxLength={GRAPH_VIEW_NAME_MAX_LENGTH}
                      onChange={(e) => {
                        setRenameDraft(e.target.value)
                      }}
                      className={cn(FIELD_CLASS, 'min-w-32 flex-1')}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        commitRename(view)
                      }}
                      disabled={normalizeGraphViewName(renameDraft).length === 0}
                      className="min-h-touch rounded bg-primary px-2 text-label font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-ring disabled:opacity-50"
                    >
                      {translate('graph.queries.views.renameConfirm')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(null)
                      }}
                      className="min-h-touch rounded px-2 text-label font-medium text-ink-mute transition-colors hover:text-ink focus-ring"
                    >
                      {translate('graph.queries.views.renameCancel')}
                    </button>
                  </>
                ) : (
                  <>
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
                      aria-label={translate('graph.queries.views.renameAria', view.name)}
                      onClick={() => {
                        startRename(view)
                      }}
                      className="min-h-touch rounded px-2 text-label font-medium text-ink-mute transition-colors hover:text-ink focus-ring"
                    >
                      {translate('graph.queries.views.rename')}
                    </button>
                    <button
                      type="button"
                      aria-label={translate('graph.queries.views.duplicateAria', view.name)}
                      onClick={() => {
                        duplicate(view)
                      }}
                      className="min-h-touch rounded px-2 text-label font-medium text-ink-mute transition-colors hover:text-ink focus-ring"
                    >
                      {translate('graph.queries.views.duplicate')}
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
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  )
}
