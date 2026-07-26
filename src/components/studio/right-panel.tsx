'use client'

import { useStudioStore, useFilteredEntities } from '@/lib/studio/store'
import { ENTITY_TYPE_META } from '@/lib/studio/types'
import { search, type SearchResult } from '@/lib/search/retrieval'
import { Search, X, Sparkles, FileText, Quote, ArrowRight } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Overlay } from '@/components/studio/ui/shared-primitives'

export function RightPanel() {
  const currentView = useStudioStore((s) => s.currentView)
  const rightPanelOpen = useStudioStore((s) => s.rightPanelOpen)
  const chat = useStudioStore((s) => s.chat)

  if (!rightPanelOpen) return null

  // Contextual content per view
  if (currentView === 'graph' || currentView === 'mindmap') {
    return <InspectorPanel />
  }
  if (currentView === 'chat' || currentView === 'ai') {
    const hasCitations = chat.some((m) => m.citations && m.citations.length > 0)
    if (!hasCitations) return <SearchPanel />
    return <CitationsPanel />
  }

  return <SearchPanel />
}

function SearchPanel() {
  const searchQuery = useStudioStore((s) => s.searchQuery)
  const setSearchQuery = useStudioStore((s) => s.setSearchQuery)
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const startEdit = useStudioStore((s) => s.startEdit)
  const [mode, setMode] = useState<'keyword' | 'ranked'>('keyword')
  const filtered = useFilteredEntities()
  const rankedResults = useMemo(
    () => (mode === 'ranked' ? search(entities, claims, searchQuery) : []),
    [mode, entities, claims, searchQuery],
  )

  const results = mode === 'ranked' ? rankedResults : filtered

  return (
    <aside className="hidden h-full w-[320px] shrink-0 flex-col border-l border-border bg-background wide:flex">
      <div className="border-b border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-serif text-[14px] font-semibold text-ink">Search</h2>
          <button
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint transition-colors hover:text-ink focus-ring"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge base…"
            aria-label="Search knowledge base"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
          />
        </div>
        <div className="mt-2 flex items-center gap-1 rounded-md bg-muted p-0.5 text-label">
          <button
            onClick={() => { setMode('keyword') }}
            aria-pressed={mode === 'keyword'}
            className={cn(
              'flex-1 rounded px-2 py-1 font-medium transition-colors focus-ring min-h-[44px]',
              mode === 'keyword' ? 'bg-background text-ink shadow-sm' : 'text-ink-mute',
            )}
          >
            Keyword
          </button>
          <button
            onClick={() => { setMode('ranked') }}
            aria-pressed={mode === 'ranked'}
            className={cn(
              'flex-1 rounded px-2 py-1 font-medium transition-colors focus-ring min-h-[44px]',
              mode === 'ranked' ? 'bg-background text-ink shadow-sm' : 'text-ink-mute',
            )}
          >
            Ranked
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-ink-faint/50" />
            <p className="text-[12px] text-ink-mute">
              {searchQuery ? 'No matches found.' : 'Your library is empty.'}
            </p>
          </div>
        ) : mode === 'ranked' ? (
          <ul className="space-y-1.5" role="group" aria-label="Ranked search results">
            {rankedResults.map((r: SearchResult) => {
              const targetId = r.type === 'entity' ? r.id : r.entityId
              const resolvedEntity = targetId ? entities.find((e) => e.id === targetId) : undefined
              const meta = resolvedEntity ? ENTITY_TYPE_META[resolvedEntity.type] : undefined
              return (
                <li key={r.id}>
                  <button
                    onClick={() => targetId && startEdit(targetId)}
                    className="group block w-full rounded-md border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-ring"
                    aria-label={`${r.name} — score ${r.score.toFixed(2)}`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {meta && <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />}
                      {meta && (
                        <span className="rounded px-1.5 py-0 text-badge font-semibold uppercase tracking-wide text-ink-faint">
                          {meta.label}
                        </span>
                      )}
                      <span className="ml-auto text-caption tabular-nums text-ink-faint">
                        {r.score.toFixed(1)}
                      </span>
                    </div>
                    <div className="truncate text-[13px] font-medium text-ink">{r.name}</div>
                    <p className="mt-0.5 line-clamp-2 text-label leading-snug text-ink-mute">
                      {r.snippet}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="space-y-1.5" role="group" aria-label="Keyword search results">
            {filtered.slice(0, 20).map((e) => {
              const meta = ENTITY_TYPE_META[e.type]
              return (
                <li key={e.id}>
                  <button
                    onClick={() => startEdit(e.id)}
                    className="group block w-full rounded-md border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-ring"
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
        )}
      </div>

      <div className="border-t border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-label text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Local search · {entities.length} entities
        </div>
      </div>
    </aside>
  )
}

function InspectorPanel() {
  const entities = useStudioStore((s) => s.entities)
  const selectedEntityId = useStudioStore((s) => s.selectedEntityId)
  const startEdit = useStudioStore((s) => s.startEdit)
  const deleteEntity = useStudioStore((s) => s.deleteEntity)
  const selectEntity = useStudioStore((s) => s.selectEntity)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const entity = entities.find((e) => e.id === selectedEntityId) || entities[0]
  const deleteCancelRef = useRef<HTMLButtonElement>(null)

  if (!entity) {
    return (
      <aside className="hidden h-full w-[320px] shrink-0 border-l border-border bg-background wide:flex">
        <div className="flex h-full flex-1 items-center justify-center p-6 text-center text-[12px] text-ink-mute">
          Select a node to inspect.
        </div>
      </aside>
    )
  }

  const meta = ENTITY_TYPE_META[entity.type]

  const handleDelete = () => {
    deleteEntity(entity.id)
    selectEntity(null)
    setShowDeleteConfirm(false)
  }

  return (
    <aside className="hidden h-full w-[340px] shrink-0 flex-col border-l border-border bg-background wide:flex">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-serif text-[14px] font-semibold text-ink">Inspector</h2>
        <button
          onClick={() => selectEntity(null)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint transition-colors hover:text-ink focus-ring"
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
          <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
            {meta.label}
          </span>
        </div>
        <h3 className="font-serif text-lg font-semibold leading-tight text-ink">{entity.name}</h3>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-mute">{entity.description}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {entity.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-ink-mute"
            >
              #{t}
            </span>
          ))}
        </div>

        {entity.links.length > 0 && (
          <div className="mt-5">
            <h4 className="mb-2 text-caption font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Connections ({entity.links.length})
            </h4>
            <ul className="space-y-1">
              {entity.links.map((l, i) => {
                const target = entities.find((e) => e.id === l.targetId)
                if (!target) return null
                return (
                  <li key={i}>
                    <button
                      onClick={() => selectEntity(target.id)}
                      className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-[12px] text-ink-soft transition-colors hover:bg-muted focus-ring"
                    >
                      <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" />
                      <span className="flex-1 truncate">{target.name}</span>
                      <span className="text-caption italic text-ink-faint">{l.relation}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="mt-5 border-t border-border pt-3 text-label text-ink-faint">
          Updated {new Date(entity.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <button
          onClick={() => startEdit(entity.id)}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 press-scale focus-ring min-h-[44px]"
        >
          Edit
        </button>
        <button
          onClick={() => { setShowDeleteConfirm(true) }}
          className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 focus-ring min-h-[44px]"
        >
          Delete
        </button>
      </div>

      {showDeleteConfirm && (
        <Overlay
          open={showDeleteConfirm}
          onClose={() => { setShowDeleteConfirm(false) }}
          aria-label="Confirm delete"
          initialFocusRef={deleteCancelRef}
        >
          <div className="w-[340px] rounded-xl border border-border bg-popover p-5 shadow-2xl">
            <h3 className="mb-2 font-serif text-[14px] font-semibold text-ink">Delete entity?</h3>
            <p className="mb-4 text-[12px] text-ink-mute">
              &quot;{entity.name}&quot; will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                ref={deleteCancelRef}
                onClick={() => { setShowDeleteConfirm(false) }}
                className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-red-700 focus-ring min-h-[44px]"
              >
                Delete
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </aside>
  )
}

function CitationsPanel() {
  const chat = useStudioStore((s) => s.chat)
  const entities = useStudioStore((s) => s.entities)
  const lastAssistant = [...chat].reverse().find((m) => m.role === 'assistant')
  const citations = lastAssistant?.citations || []

  return (
    <aside className="hidden h-full w-[320px] shrink-0 flex-col border-l border-border bg-background wide:flex">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Quote className="h-3.5 w-3.5 text-saffron" />
        <h2 className="font-serif text-[14px] font-semibold text-ink">Cited sources</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {citations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Sparkles className="h-8 w-8 text-ink-faint/40" />
            <p className="px-6 text-[12px] text-ink-mute">
              When the assistant cites your library, the sources appear here for verification.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {citations.map((c, i) => (
              <li
                key={i}
                className="rounded-md border border-border bg-muted/30 p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-saffron text-badge font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-[12px] font-medium text-ink">{c.entityName}</span>
                </div>
                <p className="text-label leading-snug text-ink-mute">{c.snippet}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-label text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Grounded in {entities.length} local entities
        </div>
      </div>
    </aside>
  )
}
