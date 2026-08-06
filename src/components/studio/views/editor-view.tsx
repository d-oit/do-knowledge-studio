'use client'

import { useStudioStore } from '@/lib/studio/store'
import {
  type Entity,
  type EntityType,
} from '@/lib/studio/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import Markdown from 'react-markdown'
import {
  ExternalLink,
} from 'lucide-react'
import { EditorToolbar } from './editor-toolbar'
import { CursorTracker } from '../remote-cursors'
import { ClaimsPanel } from './editor-claims-panel'
import { EditorHeader, EditorTags } from './editor-helpers'
import {
  applyBold,
  applyItalic,
  applyHeading,
  applyBulletList,
  applyOrderedList,
  applyQuote,
  applyInlineCode,
  applyLink,
  removeDraft,
} from '@/lib/editor'
import {
  useEditorDraft,
  useEditorKeyboardShortcuts,
  EditorModeSelector,
  EditorStatusBar,
} from '../editor-hooks'

const SERIF_FONT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-newsreader), Georgia, serif',
} as const

const ADVANCED_METADATA_TITLE = 'Metadata & source'
const ADVANCED_METADATA_DESCRIPTION = 'Optional context that helps you find and revisit this note later. Tags stay visible above for quick editing.'

const restoreSelection = (textarea: HTMLTextAreaElement, start: number, end: number) => {
  textarea.focus()
  textarea.setSelectionRange(start, end)
}

/** Rich-text entity editor with markdown preview, claims panel, and draft persistence. */
export const EditorView = () => {
  const entities = useStudioStore((s) => s.entities)
  const editingEntityId = useStudioStore((s) => s.editingEntityId)
  const commitEntity = useStudioStore((s) => s.commitEntity)
  const finishEditing = useStudioStore((s) => s.finishEditing)
  const claims = useStudioStore((s) => s.claims)
  const addClaim = useStudioStore((s) => s.addClaim)
  const updateClaim = useStudioStore((s) => s.updateClaim)
  const deleteClaim = useStudioStore((s) => s.deleteClaim)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [editMode, setEditMode] = useState<'edit' | 'preview' | 'split'>('edit')

  const { draftStatus, draftIdRef } = useEditorDraft({
    editing,
    name,
    content,
    description,
    type,
    sourceUrl,
    tags,
    setName,
    setContent,
    setDescription,
    setType,
    setSourceUrl,
    setTags,
  })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setEditMode((prev) => prev === 'split' ? 'edit' : prev)
      }
    }
    handleChange(mq)
    mq.addEventListener('change', handleChange)
    return () => { mq.removeEventListener('change', handleChange) }
  }, [])

  const wordCount = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content],
  )
  const charCount = content.length
  const isDirty = editing
    ? editing.name !== name ||
      editing.content !== content ||
      editing.type !== type ||
      editing.description !== description ||
      (editing.sourceUrl || '') !== sourceUrl ||
      JSON.stringify(editing.tags) !== JSON.stringify(tags)
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
      toast.error('Entity name cannot be empty')
      return
    }
    const entity: Entity = {
      id: editing?.id || crypto.randomUUID(),
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

  useEditorKeyboardShortcuts({ handleFormat, handleSave })

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-10 lg:py-8">
      <EditorHeader
        editing={editing}
        name={name}
        onNameChange={setName}
        type={type}
        description={description}
        onDescriptionChange={setDescription}
      />

      <EditorTags
        tags={tags}
        onTagsChange={setTags}
        type={type}
        showTypeMenu={showTypeMenu}
        onToggleTypeMenu={() => { setShowTypeMenu(!showTypeMenu) }}
        onSelectType={(t) => { setType(t); setShowTypeMenu(false) }}
      />

      <EditorToolbar
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => { setShowAdvanced(!showAdvanced) }}
        onFormat={handleFormat}
        onVoiceTranscript={(text) => { setContent((prev) => `${prev} ${text}`) }}
      />

      {showAdvanced && (
        <div
          className="mb-4 space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-4"
          role="group"
          aria-labelledby="advanced-fields-heading"
        >
          <div>
            <h3 id="advanced-fields-heading" className="font-serif text-[15px] font-semibold text-ink">
              {ADVANCED_METADATA_TITLE}
            </h3>
            <p className="mt-1 text-label leading-relaxed text-ink-mute">
              {ADVANCED_METADATA_DESCRIPTION}
            </p>
          </div>
          <div>
            <label htmlFor="source-url" className="mb-1 flex items-center gap-1.5 text-label font-semibold uppercase tracking-wide text-ink-faint">
              <ExternalLink className="h-3 w-3" />
              Source URL
            </label>
            <input
              id="source-url"
              value={sourceUrl}
              onChange={(e) => { setSourceUrl(e.target.value) }}
              placeholder="https://…"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
            />
          </div>
        </div>
      )}

      <EditorModeSelector editMode={editMode} onEditModeChange={setEditMode} />

      <CursorTracker view="editor">
        <div className={editMode === 'split' ? 'grid grid-cols-2 gap-4' : 'relative'}>
        {(editMode === 'edit' || editMode === 'split') && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
            }}
            placeholder="Start writing. Use markdown for headings, lists, and emphasis…"
            className={`min-h-[420px] w-full resize-none bg-transparent font-serif text-[16px] leading-[1.75] text-ink placeholder:text-ink-faint/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 focus-visible:ring-inset ${editMode === 'split' ? 'rounded-lg border border-border p-4' : ''}`}
            style={SERIF_FONT_STYLE}
            aria-label="Editor content"
          />
        )}
        {(editMode === 'preview' || editMode === 'split') && (
          <div className="prose prose-sm dark:prose-invert max-w-none min-h-[420px] rounded-lg border border-border bg-background p-4">
            <Markdown>{content || '_Nothing to preview._'}</Markdown>
          </div>
        )}
        </div>
      </CursorTracker>

      {editing && (
        <ClaimsPanel
          claims={entityClaims}
          editingEntityId={editing.id}
          addClaim={addClaim}
          updateClaim={updateClaim}
          deleteClaim={deleteClaim}
        />
      )}

      <EditorStatusBar
        wordCount={wordCount}
        charCount={charCount}
        isDirty={isDirty}
        draftStatus={draftStatus}
        editing={editing}
        onDiscard={handleDiscard}
        onSave={handleSave}
        nameValid={name.trim().length > 0}
      />
    </div>
  )
}
