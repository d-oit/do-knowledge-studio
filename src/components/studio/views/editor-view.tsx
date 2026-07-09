'use client'

import { useStudioStore } from '@/lib/studio/store'
import {
  ENTITY_TYPE_META,
  type Entity,
  type EntityType,
} from '@/lib/studio/types'
import { useState, useMemo } from 'react'
import Markdown from 'react-markdown'
import {
  Save,
  X,
  Plus,
  ChevronDown,
  ExternalLink,
  Tag,
  FileText,
  Lightbulb,
  User,
  FolderKanban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { EditorToolbar } from './editor-toolbar'
import { ClaimsPanel } from './editor-claims-panel'

const TYPE_ICONS: Record<EntityType, typeof FileText> = {
  note: FileText,
  concept: Lightbulb,
  person: User,
  project: FolderKanban,
}

export function EditorView() {
  const { entities, editingEntityId, saveEntity, startNew, claims, addClaim } = useStudioStore()

  const editing = useMemo(
    () => entities.find((e) => e.id === editingEntityId) || null,
    [entities, editingEntityId],
  )

  const entityClaims = useMemo(
    () => (editingEntityId ? claims.filter((c) => c.entityId === editingEntityId) : []),
    [claims, editingEntityId],
  )

  const [name, setName] = useState(editing?.name || '')
  const [type, setType] = useState<EntityType>(editing?.type || 'note')
  const [content, setContent] = useState(editing?.content || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [sourceUrl, setSourceUrl] = useState(editing?.sourceUrl || '')
  const [tags, setTags] = useState<string[]>(editing?.tags || [])
  const [newTag, setNewTag] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  const charCount = content.length
  const isDirty = editing
    ? editing.name !== name ||
      editing.content !== content ||
      editing.type !== type ||
      editing.description !== description
    : name.trim() !== '' || content.trim() !== ''

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Entity name is required')
      return
    }
    const entity: Entity = {
      id: editing?.id || `e-${Date.now().toString(36)}`,
      name: name.trim(),
      type,
      description: description.trim() || content.slice(0, 200).replace(/[#*]/g, '').trim(),
      content,
      sourceUrl: sourceUrl.trim() || undefined,
      tags,
      createdAt: editing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      links: editing?.links || [],
    }
    saveEntity(entity)
    toast.success(editing ? 'Entity updated' : 'Entity saved to library')
  }

  const handleCancel = () => {
    startNew()
    setName('')
    setType('note')
    setContent('')
    setDescription('')
    setSourceUrl('')
    setTags([])
  }

  const addTag = () => {
    const t = newTag.trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags([...tags, t])
    setNewTag('')
  }

  const meta = ENTITY_TYPE_META[type]
  const TypeIcon = TYPE_ICONS[type]

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-10 lg:py-8">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', meta.bg, meta.text)}>
            <TypeIcon className="h-3 w-3" />
            {meta.label}
          </span>
          {editing && (
            <span className="text-[11px] text-ink-faint">
              Edited {new Date(editing.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Entity name…"
          className="w-full bg-transparent font-serif text-3xl font-semibold leading-tight tracking-tight text-ink placeholder:text-ink-faint/60 focus:outline-none"
          autoFocus={!editing}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description (optional)…"
          rows={2}
          className="mt-2 w-full resize-none bg-transparent text-[14px] leading-relaxed text-ink-mute placeholder:text-ink-faint/60 focus:outline-none"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
          >
            <TypeIcon className={cn('h-3.5 w-3.5', meta.text)} />
            Type: {meta.label}
            <ChevronDown className="h-3 w-3" />
          </button>
          {showTypeMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-lg">
              {(Object.keys(ENTITY_TYPE_META) as EntityType[]).map((t) => {
                const m = ENTITY_TYPE_META[t]
                const Icon = TYPE_ICONS[t]
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setType(t)
                      setShowTypeMenu(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] transition-colors hover:bg-muted',
                      t === type ? 'font-semibold text-ink' : 'text-ink-soft',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', m.text)} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {tags.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft"
          >
            #{t}
            <button
              onClick={() => setTags(tags.filter((x) => x !== t))}
              className="text-ink-faint hover:text-red-500"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5">
          <Tag className="h-2.5 w-2.5 text-ink-faint" />
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="add tag"
            className="w-16 bg-transparent text-[11px] text-ink-soft placeholder:text-ink-faint focus:outline-none"
          />
          {newTag && (
            <button onClick={addTag} className="text-saffron hover:text-saffron-deep">
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      <EditorToolbar
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
      />

      {showAdvanced && (
        <div className="mb-4 space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              <ExternalLink className="h-3 w-3" />
              Source URL
            </label>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
            />
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setPreviewMode(false)}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${!previewMode ? 'bg-muted text-ink' : 'text-ink-mute hover:bg-muted/50'}`}
        >
          Edit
        </button>
        <button
          onClick={() => setPreviewMode(true)}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${previewMode ? 'bg-muted text-ink' : 'text-ink-mute hover:bg-muted/50'}`}
        >
          Preview
        </button>
      </div>

      <div className="relative">
        {previewMode ? (
          <div className="prose prose-sm dark:prose-invert max-w-none min-h-[420px] rounded-lg border border-border bg-background p-4">
            <Markdown>{content || '_Nothing to preview._'}</Markdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing. Use markdown for headings, lists, and emphasis…"
            className="min-h-[420px] w-full resize-none bg-transparent font-serif text-[16px] leading-[1.75] text-ink placeholder:text-ink-faint/60 focus:outline-none"
            style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
          />
        )}
      </div>

      {editing && (
        <ClaimsPanel
          claims={entityClaims}
          editingEntityId={editing.id}
          addClaim={addClaim}
        />
      )}

      <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between border-t border-border bg-background/90 px-6 py-3 backdrop-blur-sm lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-3 text-[11px] text-ink-faint">
          <span>{wordCount} words</span>
          <span>·</span>
          <span>{charCount} chars</span>
          {isDirty && (
            <>
              <span>·</span>
              <span className="text-saffron">Unsaved</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <button
              onClick={handleCancel}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
            >
              Cancel edit
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
          >
            <Save className="h-3.5 w-3.5" />
            {editing ? 'Update entity' : 'Save to library'}
          </button>
        </div>
      </div>
    </div>
  )
}
