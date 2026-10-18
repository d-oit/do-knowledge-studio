'use client'

import { useStudioStore } from '@/lib/studio/store'
import { getEntityTypeMeta } from '@/lib/studio/entity-types'
import { buildEntityIndex } from '@/lib/studio/graph-index'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as announceT } from '@/lib/i18n/messages/announce'
import { translate as graphT } from '@/lib/i18n/messages/graph'
import type { Entity } from '@/lib/studio/types'
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/studio/ui/shared-primitives'
import { translate as confirmT } from '@/lib/i18n/messages/confirm'
import { CitationsPanel } from './right-panel-citations'
import { PanelCloseButton } from './right-panel-close-button'
import { EntitySearchPanel } from './entity-search-panel'

/** Shared width for every right-panel aside — one value, no per-view reflow (#868). */
const PANEL_WIDTH_CLASS = 'w-[320px]' as const

/**
 * Dedupes an entity's links for rendering: the persisted schema permits
 * repeated `{ targetId, relation }` objects (imports/legacy data), which
 * would otherwise produce duplicate React keys. Keeps first occurrence
 * order-stable.
 */
const dedupeLinks = (links: Entity['links']): Entity['links'] => {
  const seen = new Set<string>()
  const out: Entity['links'] = []
  for (const link of links) {
    // JSON tuple key: `:` inside an id or relation would collide distinct
    // pairs onto one key (same reason dedupeCitations uses this shape).
    const key = JSON.stringify([link.targetId, link.relation])
    if (seen.has(key)) continue
    seen.add(key)
    out.push(link)
  }
  return out
}

const SearchPanel = ({
  onCreateEntity,
  onClose,
}: {
  onCreateEntity?: (name: string) => void
  onClose: () => void
}) => {
  return (
    <aside className={`hidden h-full ${PANEL_WIDTH_CLASS} shrink-0 flex-col border-l border-border bg-background wide:flex`}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-body font-semibold text-ink">Search</h2>
          <PanelCloseButton onClose={onClose} />
        </div>
      </div>
      <EntitySearchPanel density="panel" onCreateEntity={onCreateEntity} />
    </aside>
  )
}

/** One inbound reference: an entity whose `links` target the inspected one, plus that relation. */
interface Backlink {
  entity: Entity
  relation: string
}

/**
 * Indexes inbound references by the id they point at. Sources are deduped (an
 * entity linking the same target twice is one reference, keeping its first
 * relation) and self-references are dropped, so the inspector never lists the
 * inspected entity as its own referrer. Each target's references are ordered by
 * source name, keeping the rendered list deterministic across reloads.
 */
const buildBacklinkIndex = (entities: Entity[]): Map<string, Backlink[]> => {
  const byTarget = new Map<string, Map<string, Backlink>>()
  for (const entity of entities) {
    for (const link of entity.links) {
      if (link.targetId === entity.id) continue
      const sources = byTarget.get(link.targetId) ?? new Map<string, Backlink>()
      if (!sources.has(entity.id)) {
        sources.set(entity.id, { entity, relation: link.relation })
      }
      byTarget.set(link.targetId, sources)
    }
  }
  const index = new Map<string, Backlink[]>()
  for (const [targetId, sources] of byTarget) {
    index.set(
      targetId,
      [...sources.values()].sort((a, b) => a.entity.name.localeCompare(b.entity.name)),
    )
  }
  return index
}

/** One row of the panel's connection and backlink lists (same markup, different direction). */
const EntityRow = ({
  icon: Icon,
  name,
  relation,
  onSelect,
}: {
  icon: LucideIcon
  name: string
  relation: string
  onSelect: () => void
}) => (
  <li>
    <button
      onClick={onSelect}
      className="flex w-full min-h-touch items-center gap-2 rounded-md p-1.5 text-left text-label-lg text-ink-soft transition-colors hover:bg-muted focus-ring"
    >
      <Icon className="h-3 w-3 shrink-0 text-ink-faint" />
      <span className="flex-1 truncate">{name}</span>
      <span className="text-caption italic text-ink-faint">{relation}</span>
    </button>
  </li>
)

/** Connection rows for the inspector (linked entities with their relation). */
const ConnectionList = ({
  links,
  entityIndex,
  onSelect,
}: {
  links: Entity['links']
  entityIndex: Map<string, Entity>
  onSelect: (id: string) => void
}) => (
  <ul className="space-y-1">
    {dedupeLinks(links).map((l) => {
      const target = entityIndex.get(l.targetId)
      if (!target) return null
      return (
        <EntityRow
          key={JSON.stringify([l.targetId, l.relation])}
          icon={ArrowRight}
          name={target.name}
          relation={l.relation}
          onSelect={() => { onSelect(target.id) }}
        />
      )
    })}
  </ul>
)

/** Inbound rows for the inspector: entities that link TO the inspected one. */
const BacklinkList = ({
  backlinks,
  onSelect,
}: {
  backlinks: Backlink[]
  onSelect: (entity: Entity) => void
}) => (
  <ul className="space-y-1">
    {backlinks.map(({ entity, relation }) => (
      <EntityRow
        key={entity.id}
        icon={ArrowLeft}
        name={entity.name}
        relation={relation}
        onSelect={() => { onSelect(entity) }}
      />
    ))}
  </ul>
)

/** Inspector panel showing details, connections, backlinks, and actions for the selected node. */
const InspectorPanel = ({ onClose }: { onClose: () => void }) => {
  const entities = useStudioStore((s) => s.entities)
  const selectedEntityId = useStudioStore((s) => s.selectedEntityId)
  const startEdit = useStudioStore((s) => s.startEdit)
  const deleteEntity = useStudioStore((s) => s.deleteEntity)
  const selectEntity = useStudioStore((s) => s.selectEntity)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const announce = useAnnouncer()
  const entityIndex = useMemo(() => buildEntityIndex(entities), [entities])
  const backlinkIndex = useMemo(() => buildBacklinkIndex(entities), [entities])
  const entity = (selectedEntityId ? entityIndex.get(selectedEntityId) : undefined) || entities[0]

  if (!entity) {
    return (
      <aside className={`hidden h-full ${PANEL_WIDTH_CLASS} shrink-0 flex-col border-l border-border bg-background wide:flex`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-serif text-body font-semibold text-ink">Inspector</h2>
          <PanelCloseButton onClose={onClose} />
        </div>
        <div className="flex h-full flex-1 items-center justify-center p-6 text-center text-label-lg text-ink-mute">
          Select a node to inspect.
        </div>
      </aside>
    )
  }

  const meta = getEntityTypeMeta(entity.type)
  const backlinks = backlinkIndex.get(entity.id) ?? []

  const handleDelete = () => {
    // The panel closes over the deleted entity with no visual trace beyond
    // the list shrinking, so name the casualty in the live region.
    announce(announceT('announce.entityDeleted', entity.name))
    deleteEntity(entity.id)
    selectEntity(null)
    setShowDeleteConfirm(false)
  }

  return (
    <aside className={`hidden h-full ${PANEL_WIDTH_CLASS} shrink-0 flex-col border-l border-border bg-background wide:flex`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-serif text-body font-semibold text-ink">Inspector</h2>
        <PanelCloseButton onClose={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
          <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
            {meta.label}
          </span>
        </div>
        <h3 className="font-serif text-lg font-semibold leading-tight text-ink">{entity.name}</h3>
        <p className="mt-2 text-label-lg leading-relaxed text-ink-mute">{entity.description}</p>

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
              Connections ({dedupeLinks(entity.links).length})
            </h4>
            {/* ConnectionList renders its own <ul>; a wrapper <ul> here would nest
                lists directly (axe `list` violation), so use a plain <div>. */}
            <div>
              {/* Selection changes are visual-only, so name the new subject in
                  the live region (WCAG 4.1.3, Plan 158 P2-9). */}
              <ConnectionList
                links={entity.links}
                entityIndex={entityIndex}
                onSelect={(id) => {
                  const target = entityIndex.get(id)
                  selectEntity(id)
                  if (target) announce(announceT('announce.entitySelected', target.name))
                }}
              />
            </div>
          </div>
        )}

        {/* Nothing references this entity: the section is absent rather than
            empty, so a node with no inbound links does not shift the layout. */}
        {backlinks.length > 0 && (
          <div className="mt-5">
            <h4 className="mb-2 text-caption font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {graphT('graph.inspector.referencedBy', String(backlinks.length))}
            </h4>
            {/* BacklinkList renders its own <ul>; a wrapper <ul> here would nest
                lists directly (axe `list` violation), so use a plain <div>. */}
            <div>
              <BacklinkList
                backlinks={backlinks}
                onSelect={(source) => {
                  selectEntity(source.id)
                  announce(announceT('announce.entitySelected', source.name))
                }}
              />
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-border pt-3 text-label text-ink-faint">
          Updated {new Date(entity.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <button
          onClick={() => startEdit(entity.id)}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-label-lg font-semibold text-primary-foreground transition-opacity hover:opacity-90 press-scale focus-ring min-h-touch"
        >
          Edit
        </button>
        <button
          onClick={() => { setShowDeleteConfirm(true) }}
          className="rounded-md border border-border px-3 py-1.5 text-label-lg font-medium text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 focus-ring min-h-touch"
        >
          Delete
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteConfirm(false) }}
        title={confirmT('confirm.deleteEntity.title')}
        body={confirmT('confirm.deleteEntity.body', entity.name)}
        confirmLabel={confirmT('confirm.deleteEntity.confirm')}
        destructive
      />
    </aside>
  )
}

/** Right sidebar panel that switches between search, inspector, and citations based on the active view. */
export const RightPanel = () => {
  const currentView = useStudioStore((s) => s.currentView)
  const rightPanelOpen = useStudioStore((s) => s.rightPanelOpen)
  const chat = useStudioStore((s) => s.chat)
  const entities = useStudioStore((s) => s.entities)
  const startNew = useStudioStore((s) => s.startNew)
  const setRightPanelOpen = useStudioStore((s) => s.setRightPanelOpen)
  const handleClose = useCallback(() => {
    setRightPanelOpen(false)
  }, [setRightPanelOpen])

  if (!rightPanelOpen) return null

  // Contextual content per view
  if (currentView === 'graph' || currentView === 'mindmap') {
    return <InspectorPanel onClose={handleClose} />
  }
  if (currentView === 'chat' || currentView === 'ai') {
    const hasCitations = chat.some((m) => m.citations && m.citations.length > 0)
    if (!hasCitations) return <SearchPanel onCreateEntity={() => startNew()} onClose={handleClose} />
    return <CitationsPanel chat={chat} entities={entities} onClose={handleClose} />
  }

  return <SearchPanel onCreateEntity={() => startNew()} onClose={handleClose} />
}
