'use client'

import { useStudioStore } from '@/lib/studio/store'
import {
  ENTITY_TYPE_META,
  type Entity,
  type EntityType,
} from '@/lib/studio/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { EditorToolbar } from './editor-toolbar'
import { ClaimsPanel } from './editor-claims-panel'
import {
  applyBold,
  applyItalic,
  applyHeading,
  applyBulletList,
  applyOrderedList,
  applyQuote,
  applyInlineCode,
  applyLink,
  generateDraftId,
  saveDraft,
  loadDraft,
  removeDraft,
  type EditorDraft,
} from '@/lib/editor'

const TYPE_ICONS: Record<EntityType, typeof FileText> = {
  note: FileText,
  concept: Lightbulb,
  person: User,
  project: FolderKanban,
}

function restoreSelection(textarea: HTMLTextAreaElement, start: number, end: number) {
  textarea.focus()
  textarea.setSelectionRange(start, end)
}

export function EditorView() {
  const { entities, editingEntityId, commitEntity, finishEditing, claims, addClaim } = useStudioStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftIdRef = useRef<string>('')

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
  const [draftStatus, setDraftStatus] = useState<'saved' | 'unsaved' | 'error' | null>(null)

  // Initialize draft ID on mount
  useEffect(() => {
    if (editing?.id) {
      draftIdRef.current = `draft-${editing.id}`
      const existing = loadDraft(draftIdRef.current)
      if (existing) {
        setName(existing.name)
        setContent(existing.content)
        setDescription(existing.description)
        setType(existing.type as EntityType)
        setSourceUrl(existing.sourceUrl)
        setTags(existing.tags)
      }
    } else {
      draftIdRef.current = generateDraftId()
    }
  }, [editing?.id])

  // Debounced draft persistence
  useEffect(() => {
    if (!draftIdRef.current) return
    const timer = setTimeout(() => {
      const draft: EditorDraft = {
        id: draftIdRef.current,
        entityId: editing?.id || null,
        name,
        content,
        description,
        type,
        sourceUrl,
        tags,
        createdAt: editing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      }
      try {
        saveDraft(draft)
        setDraftStatus('saved')
      } catch {
        setDraftStatus('error')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [name, content, description, type, sourceUrl, tags, editing?.id, editing?.createdAt])

  // Flush draft on unmount
  useEffect(() => {
    return () => {
      if (draftIdRef.current) {
        const draft: EditorDraft = {
          id: draftIdRef.current,
          entityId: editing?.id || null,
          name,
          content,
          description,
          type,
          sourceUrl,
          tags,
          createdAt: editing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        }
        try {
          saveDraft(draft)
        } catch {
          // Best-effort flush on unmount
        }
      }
    }
  }, [name, content, description, type, sourceUrl, tags, editing?.id, editing?.createdAt])

  const wordCount = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content],
  )
  const charCount = content.length
  const isDirty = editing
    ? editing.name !== name ||
      editing.content !== content ||
      editing.type !== type ||
      editing.description !== description
    : name.trim() !== '' || content.trim() !== ''

  const handleFormat = useCallback((command: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const sel = {
      text: content.slice(textarea.selectionStart, textarea.selectionEnd),
      range: { start: textarea.selectionStart, end: textarea.selectionEnd },
      lineStart: content.slice(0, textarea.selectionStart).lastIndexOf('\n') + 1,
      lineEnd: (() => {
        const after = content.slice(textarea.selectionEnd)
        const n = after.indexOf('\n')
        return n === -1 ? content.length : textarea.selectionEnd + n
      })(),
    }
    let result
    switch (command) {
      case 'bold': result = applyBold(content, sel); break
      case 'italic': result = applyItalic(content, sel); break
      case 'h1': result = applyHeading(content, sel, 1); break
      case 'h2': result = applyHeading(content, sel, 2); break
      case 'bullet': result = applyBulletList(content, sel); break
      case 'ordered': result = applyOrderedList(content, sel); break
      case 'quote': result = applyQuote(content, sel); break
      case 'code': result = applyInlineCode(content, sel); break
      case 'link': result = applyLink(content, sel); break
      default: return
    }
    setContent(result.text)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) restoreSelection(el, result.selection.start, result.selection.end)
    })
  }, [content])

  const handleSave = () => {
    if (!name.trim()) {
      // Validation error toast — exceptional, keep
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
    commitEntity(entity)
    // Remove draft on commit
    if (draftIdRef.current) removeDraft(draftIdRef.current)
  }

  const handleDiscard = () => {
    if (draftIdRef.current) removeDraft(draftIdRef.current)
    finishEditing()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      switch (e.key) {
        case 'b':
          e.preventDefault()
          handleFormat('bold')
          break
        case 'i':
          e.preventDefault()
          handleFormat('italic')
          break
        case 'k':
          e.preventDefault()
          handleFormat('link')
          break
        case 's':
          e.preventDefault()
          handleSave()
          break
      }
    }
    document.addEventListener('keydown', handler)
    return () => { document.removeEventListener('keydown', handler) }
  }, [handleFormat, handleSave])

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
        <label htmlFor="entity-name" className="sr-only">Entity name</label>
        <input
          id="entity-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Entity name…"
          className="w-full bg-transparent font-serif text-3xl font-semibold leading-tight tracking-tight text-ink placeholder:text-ink-faint/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 focus-visible:ring-inset"
          autoFocus={!editing}
        />
        <label htmlFor="entity-description" className="sr-only">Description</label>
        <textarea
          id="entity-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description (optional)…"
          rows={2}
          className="mt-2 w-full resize-none bg-transparent text-[14px] leading-relaxed text-ink-mute placeholder:text-ink-faint/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 focus-visible:ring-inset"
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
              aria-label={`Remove tag ${t}`}
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
            aria-label="Add tag"
          />
          {newTag && (
            <button onClick={addTag} className="text-saffron hover:text-saffron-deep" aria-label="Add tag">
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      <EditorToolbar
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => { setShowAdvanced(!showAdvanced) }}
        onFormat={handleFormat}
      />

      {showAdvanced && (
        <div className="mb-4 space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <div>
            <label htmlFor="source-url" className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              <ExternalLink className="h-3 w-3" />
              Source URL
            </label>
            <input
              id="source-url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
            />
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 border-b border-border pb-2" role="radiogroup" aria-label="Editor mode">
        <button
          role="radio"
          aria-checked={!previewMode}
          onClick={() => { setPreviewMode(false) }}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${!previewMode ? 'bg-muted text-ink' : 'text-ink-mute hover:bg-muted/50'}`}
        >
          Edit
        </button>
        <button
          role="radio"
          aria-checked={previewMode}
          onClick={() => { setPreviewMode(true) }}
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
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setDraftStatus('unsaved')
            }}
            placeholder="Start writing. Use markdown for headings, lists, and emphasis…"
            className="min-h-[420px] w-full resize-none bg-transparent font-serif text-[16px] leading-[1.75] text-ink placeholder:text-ink-faint/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 focus-visible:ring-inset"
            style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            aria-label="Editor content"
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
              <span className="text-saffron">Unsaved changes</span>
            </>
          )}
          {draftStatus === 'saved' && !isDirty && (
            <>
              <span>·</span>
              <span className="text-sage">Draft saved</span>
            </>
          )}
          {draftStatus === 'error' && (
            <>
              <span>·</span>
              <span className="text-red-500">Could not save draft</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <button
              onClick={handleDiscard}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-red-50 hover:text-red-600 focus-ring"
            >
              Discard changes
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 press-scale focus-ring"
          >
            <Save className="h-3.5 w-3.5" />
            {editing ? 'Commit changes' : 'Save to library'}
          </button>
        </div>
      </div>
    </div>
  )
}