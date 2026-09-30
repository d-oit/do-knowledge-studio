'use client'

import type { MarkdownCommandResult, MarkdownSelection } from '@/lib/editor/markdown-types'
import { useStudioStore } from '@/lib/studio/store'
import {
  type AnyEntityType,
  type Entity,
} from '@/lib/studio/types'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { toast } from 'sonner'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as announceT } from '@/lib/i18n/messages/announce'
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
  applyMentionBacklinks,
  extractMentionLinks,
  getMentionTrigger,
  insertMentionToken,
  mergeMentionLinks,
  type MentionTrigger,
} from '@/lib/editor/mention'

import {
  EditorMentionPicker,
  MENTION_LISTBOX_ID,
  MENTION_MAX_RESULTS,
  mentionOptionId,
} from './editor-mention-picker'
import {
  useEditorDraft,
  useEditorKeyboardShortcuts,
  EditorModeSelector,
  EditorStatusBar,
} from '../editor-hooks'
import { EditorAdvancedFields } from './editor-advanced-fields'
import { EditorPreview } from './editor-preview'

const SERIF_FONT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-newsreader), Georgia, serif',
} as const

const restoreSelection = (textarea: HTMLTextAreaElement, start: number, end: number) => {
  textarea.focus()
  textarea.setSelectionRange(start, end)
}

/** Builds the draft's Entity record from the current form state.
 * `entityId` is passed in (not generated here) so the saved id always matches
 * the id used to derive mention links and reciprocal backlinks — a locally
 * generated id would orphan every backlink written for a new entity. */
const buildEditorEntity = (
  entityId: string,
  editing: Entity | null,
  input: {
    name: string
    type: AnyEntityType
    description: string
    content: string
    sourceUrl: string
    tags: string[]
  },
  mentionLinks: { targetId: string; relation: string }[],
): Entity => {
  const fallbackDescription = input.content.slice(0, 200).replace(/[#*]/g, '').trim()
  return {
    id: entityId,
    name: input.name.trim(),
    type: input.type,
    description: input.description.trim() || fallbackDescription,
    content: input.content,
    sourceUrl: input.sourceUrl.trim() || undefined,
    tags: input.tags,
    createdAt: editing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: mergeMentionLinks(editing?.links ?? [], mentionLinks),
  }
}

/** Describes the textarea selection within the current content. */
const describeSelection = (
  content: string,
  textarea: HTMLTextAreaElement,
): MarkdownSelection => {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const after = content.slice(end)
  const newline = after.indexOf('\n')
  return {
    text: content.slice(start, end),
    range: { start, end },
    lineStart: content.slice(0, start).lastIndexOf('\n') + 1,
    lineEnd: newline === -1 ? content.length : end + newline,
  }
}

/** Format commands: command name → editor transform applied to the selection. */
/** Supported toolbar/keyboard format commands (static allowlist). */
const FORMAT_COMMANDS = [
  'bold',
  'italic',
  'h1',
  'h2',
  'bullet',
  'ordered',
  'quote',
  'code',
  'link',
] as const

type FormatCommand = (typeof FORMAT_COMMANDS)[number]

/** Narrows a raw command string to a supported FormatCommand. */
const isFormatCommand = (command: string): command is FormatCommand =>
  (FORMAT_COMMANDS as readonly string[]).includes(command)

const FORMAT_HANDLERS: Record<
  FormatCommand,
  (content: string, sel: MarkdownSelection) => MarkdownCommandResult
> = {
  bold: (c, s) => applyBold(c, s),
  italic: (c, s) => applyItalic(c, s),
  h1: (c, s) => applyHeading(c, s, 1),
  h2: (c, s) => applyHeading(c, s, 2),
  bullet: (c, s) => applyBulletList(c, s),
  ordered: (c, s) => applyOrderedList(c, s),
  quote: (c, s) => applyQuote(c, s),
  code: (c, s) => applyInlineCode(c, s),
  link: (c, s) => applyLink(c, s),
}

/** Rich-text entity editor with markdown preview, claims panel, and draft persistence. */
export const EditorView = () => {
  const entities = useStudioStore((s) => s.entities)
  const editingEntityId = useStudioStore((s) => s.editingEntityId)
  const commitEntities = useStudioStore((s) => s.commitEntities)
  const announce = useAnnouncer()
  const finishEditing = useStudioStore((s) => s.finishEditing)
  const navigateToView = useStudioStore((s) => s.navigateToView)
  const claims = useStudioStore((s) => s.claims)
  const addClaim = useStudioStore((s) => s.addClaim)
  const addClaims = useStudioStore((s) => s.addClaims)
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
  const [type, setType] = useState<AnyEntityType>(editing?.type ?? 'note')
  const [content, setContent] = useState(editing?.content || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [sourceUrl, setSourceUrl] = useState(editing?.sourceUrl || '')
  const [tags, setTags] = useState<string[]>(editing?.tags || [])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [editMode, setEditMode] = useState<'edit' | 'preview' | 'split'>('edit')
  // Caret position driving the @mention trigger (updated on change/click/keys).
  const [caret, setCaret] = useState(0)
  const [mentionHighlight, setMentionHighlight] = useState(0)
  // Trigger dismissed by Escape/blur. Bound to the content prefix at that
  // offset so deleting the `@` and typing a fresh one at the same index
  // reopens the picker (a NEW trigger), while continued query typing keeps
  // the dismissal intact.
  const [dismissedMention, setDismissedMention] = useState<{
    start: number
    prefix: string
  } | null>(null)
  const dismissMention = useCallback(
    (start: number): void => {
      setDismissedMention({ start, prefix: content.slice(0, start) })
    },
    [content],
  )

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

  /**
   * @mention entity linking (N3): the trigger derives from the live content
   * and caret — typing '@' opens the picker, moving the caret into/out of a
   * mention context opens/closes it, and the inserted token is a plain
   * markdown link `[@Name](dks://entity/<id>)` (see src/lib/editor/mention.ts
   * for the token convention and save-time link derivation).
   */
  const mentionTrigger = useMemo<MentionTrigger>(
    () => getMentionTrigger(content, caret),
    [content, caret],
  )
  // A dismissal applies only while the content prefix at the trigger offset is
  // unchanged — a deleted/re-typed `@` at the same index is a new trigger.
  const mentionOpen =
    mentionTrigger.active &&
    (dismissedMention === null ||
      dismissedMention.start !== mentionTrigger.start ||
      dismissedMention.prefix !== content.slice(0, mentionTrigger.start))

  const mentionCandidates = useMemo(() => {
    if (!mentionTrigger.active) return []
    const query = mentionTrigger.query.toLowerCase()
    return entities
      .filter((e) => e.id !== editingEntityId && e.name.toLowerCase().includes(query))
      .slice(0, MENTION_MAX_RESULTS)
  }, [entities, editingEntityId, mentionTrigger])

  // Re-anchor the highlighted option whenever the query/context changes.
  useEffect(() => {
    setMentionHighlight(0)
  }, [mentionTrigger.start, mentionTrigger.query, mentionOpen])

  const selectMention = useCallback((entity: Entity) => {
    const result = insertMentionToken(content, mentionTrigger, entity)
    setContent(result.text)
    setCaret(result.selection)
    setMentionHighlight(0)
    dismissMention(mentionTrigger.start)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) restoreSelection(el, result.selection, result.selection)
    })
  }, [content, mentionTrigger, dismissMention])

  const handleMentionKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionOpen) return
    if (e.key === 'Escape') {
      e.preventDefault()
      dismissMention(mentionTrigger.start)
      return
    }
    if (mentionCandidates.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionHighlight((i) => (i + 1) % mentionCandidates.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionHighlight((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // `.at()` returns undefined out of range; presence-check before use
      // (Codacy-safe — mirrors TRIZ_PARAMETERS.at() in triz-results-view).
      const candidate = mentionCandidates.at(mentionHighlight)
      if (candidate !== undefined) selectMention(candidate)
    }
  }, [mentionOpen, mentionCandidates, mentionHighlight, mentionTrigger.start, selectMention, dismissMention])

  const handleFormat = useCallback((command: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    // Allowlist guard narrows the key to the FormatCommand union, so the
    // lookup below is over a closed literal key space (no dynamic string
    // indexing) — mirrors the object-injection-safe pattern in `topbar`.
    if (!isFormatCommand(command)) return
    const result = FORMAT_HANDLERS[command](content, describeSelection(content, textarea))
    setContent(result.text)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) restoreSelection(el, result.selection.start, result.selection.end)
    })
  }, [content])

  /**
   * Save writes mention links DERIVED from the final content (never
   * accumulated): tokens are parsed into `links: [{ targetId, relation:
   * 'mentions' }]` merged with existing links, so removing the mention text
   * before saving automatically drops the link. Reciprocal backlinks
   * ('`mentioned-in` on each mentioned entity) are default-on; the source
   * entity and its backlinks commit under one history snapshot so a single
   * Undo restores the whole operation. Navigation to the library happens
   * only when the entity mentions someone (matches the "Save to library"
   * label); entities without mentions keep today's stay-in-editor behavior.
   */
  const handleSave = useCallback(() => {
    if (!name.trim()) {
      toast.error('Entity name cannot be empty')
      return
    }
    const entityId = editing?.id ?? crypto.randomUUID()
    const { mentionLinks, mentions } = extractMentionLinks(content, entities, entityId)
    const entity = buildEditorEntity(
      entityId,
      editing,
      { name, type, description, content, sourceUrl, tags },
      mentionLinks,
    )
    // Reciprocal backlinks + stale-backlink revocation, only touching
    // entities whose links actually changed. Committed together with the
    // source entity under a single history snapshot so one Undo restores the
    // whole operation (reverting only the backlink write would break the
    // reciprocal-link invariant).
    const mentionedIds = new Set(mentions.map((m) => m.entityId))
    const backlinkUpdates = applyMentionBacklinks(entities, entityId, mentionedIds)
    commitEntities([entity, ...backlinkUpdates])
    // A save either navigates away (mentions present) or stays put, so the
    // only reliable signal for a screen reader is the write itself.
    announce(announceT(editing ? 'announce.entitySaved' : 'announce.entityCreated', entity.name))
    // Remove draft on commit
    if (draftIdRef.current) removeDraft(draftIdRef.current)
    // Navigate to the library only when the entity actually mentions someone
    // (matches the "Save to library" label); entities without mentions keep
    // today's stay-in-editor behavior.
    if (mentions.length > 0) {
      finishEditing()
      navigateToView('library')
    }
  }, [name, type, description, content, sourceUrl, tags, editing, entities, commitEntities, finishEditing, navigateToView, draftIdRef, announce])

  const handleDiscard = () => {
    if (draftIdRef.current) removeDraft(draftIdRef.current)
    finishEditing()
  }

  useEditorKeyboardShortcuts({ handleFormat, handleSave })

  return (
    // pb reserves the height of the sticky status bar (69px measured) so the
    // last row can always be scrolled clear of it. scroll-padding alone does
    // NOT fix WCAG 2.2 SC 2.4.11 here: the status bar is a sibling inside the
    // scrolled content, so at maximum scroll it permanently overlays the last
    // 69px no matter how the browser positions a focused element (verified in
    // Chromium — the element was still 100% covered at scrollTop max).
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-6 lg:px-10 lg:pb-28 lg:pt-8">
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
        <EditorAdvancedFields sourceUrl={sourceUrl} onSourceUrlChange={setSourceUrl} />
      )}

      <EditorModeSelector editMode={editMode} onEditModeChange={setEditMode} />

      <CursorTracker view="editor">
        <div className={editMode === 'split' ? 'grid grid-cols-2 gap-4' : ''}>
        {(editMode === 'edit' || editMode === 'split') && (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setCaret(e.target.selectionStart)
              }}
              onClick={(e) => { setCaret(e.currentTarget.selectionStart) }}
              onKeyUp={(e) => { setCaret(e.currentTarget.selectionStart) }}
              onKeyDown={handleMentionKeyDown}
              onBlur={() => {
                if (mentionTrigger.active) dismissMention(mentionTrigger.start)
              }}
              placeholder="Start writing. Use markdown for headings, lists, and emphasis…"
              className={`min-h-[420px] w-full resize-none bg-transparent font-serif text-[16px] leading-[1.75] text-ink placeholder:text-ink-faint/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 focus-visible:ring-inset ${editMode === 'split' ? 'rounded-lg border border-border p-4' : ''}`}
              style={SERIF_FONT_STYLE}
              aria-label="Editor content"
              role="combobox"
              aria-expanded={mentionOpen}
              aria-controls={mentionOpen ? MENTION_LISTBOX_ID : undefined}
              aria-activedescendant={
                mentionOpen && mentionCandidates.length > 0 ? mentionOptionId(mentionHighlight) : undefined
              }
              aria-autocomplete="list"
            />
            <EditorMentionPicker
              open={mentionOpen}
              query={mentionTrigger.query}
              candidates={mentionCandidates}
              highlightedIndex={mentionHighlight}
              triggerStart={mentionTrigger.start}
              content={content}
              textarea={textareaRef}
              onHighlight={setMentionHighlight}
              onSelect={selectMention}
            />
          </div>
        )}
        {(editMode === 'preview' || editMode === 'split') && <EditorPreview content={content} />}
        </div>
      </CursorTracker>

      {editing && (
        <ClaimsPanel
          claims={entityClaims}
          editingEntityId={editing.id}
          entityContent={content}
          addClaim={addClaim}
          addClaims={addClaims}
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