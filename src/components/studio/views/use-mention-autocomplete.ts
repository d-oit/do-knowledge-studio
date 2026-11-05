import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { getMentionTrigger, insertMentionToken, type MentionTrigger } from '@/lib/editor/mention'
import type { Entity } from '@/lib/studio/types'
import { MENTION_MAX_RESULTS, mentionOptionId } from './editor-mention-picker'
import { translate as mentionsT } from '@/lib/i18n/messages/mentions'
import type { AnyEntityType } from '@/lib/studio/types'

/**
 * Mention autocomplete wiring for the editor textarea (issue #1055).
 *
 * Owns the trigger derivation, candidate filtering, highlight state (over
 * candidates plus the optional create row), token insertion, stub creation,
 * and the combobox keyboard protocol. The textarea stays the controlled
 * input; the picker component is presentational.
 *
 * Both `@query` and `[[query` openers share the canonical
 * `dks://entity/<id>` storage token, so storage and sync are unchanged.
 */

/** Longest entity name the picker's create row will mint. */
const MENTION_CREATE_NAME_LIMIT = 120

interface UseMentionAutocompleteArgs {
  content: string
  caret: number
  setContent: (text: string) => void
  setCaret: (pos: number) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  entities: Entity[]
  editingEntityId: string | null
  /** Current editor entity type: stub entities inherit it. */
  entityType: AnyEntityType
  commitEntities: (entities: Entity[]) => void
  announce: (message: string) => void
}

export interface MentionAutocomplete {
  mentionTrigger: MentionTrigger
  mentionOpen: boolean
  candidates: Entity[]
  highlight: number
  createHighlighted: boolean
  showCreate: boolean
  createLabel: string
  createAriaLabel: string
  activeDescendantId: string | undefined
  onHighlight: (index: number) => void
  onHighlightCreate: () => void
  onSelect: (entity: Entity) => void
  onCreate: () => void
  onBlur: () => void
  handleKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void
}

/** Stub entity minted by the picker's create row (respects the type selector). */
const buildStubEntity = (name: string, type: AnyEntityType): Entity => {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    type,
    description: '',
    content: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    links: [],
  }
}

export const useMentionAutocomplete = ({
  content,
  caret,
  setContent,
  setCaret,
  textareaRef,
  entities,
  editingEntityId,
  entityType,
  commitEntities,
  announce,
}: UseMentionAutocompleteArgs): MentionAutocomplete => {
  const [highlight, setHighlight] = useState(0)
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

  const mentionTrigger = useMemo<MentionTrigger>(
    () => getMentionTrigger(content, caret),
    [content, caret],
  )
  const mentionOpen =
    mentionTrigger.active &&
    (dismissedMention === null ||
      dismissedMention.start !== mentionTrigger.start ||
      dismissedMention.prefix !== content.slice(0, mentionTrigger.start))

  const candidates = useMemo(() => {
    if (!mentionTrigger.active) return []
    const query = mentionTrigger.query.toLowerCase()
    return entities
      .filter(
        (e) =>
          e.id !== editingEntityId &&
          (e.name.toLowerCase().includes(query) || e.tags.some((t) => t.toLowerCase().includes(query))),
      )
      .slice(0, MENTION_MAX_RESULTS)
  }, [entities, editingEntityId, mentionTrigger])

  const trimmedQuery = mentionTrigger.active ? mentionTrigger.query.trim() : ''
  const hasExactName = useMemo(
    () => entities.some((e) => e.name.toLowerCase() === trimmedQuery.toLowerCase()),
    [entities, trimmedQuery],
  )
  const showCreate =
    mentionTrigger.active && trimmedQuery.length > 0 && trimmedQuery.length <= MENTION_CREATE_NAME_LIMIT && !hasExactName
  const createLabel = mentionsT('mentions.picker.create', trimmedQuery)
  const createAriaLabel = mentionsT('mentions.picker.createAria', trimmedQuery)

  const totalOptions = candidates.length + (showCreate ? 1 : 0)
  const createHighlighted = showCreate && highlight === candidates.length

  useEffect(() => {
    setHighlight(0)
  }, [mentionTrigger.start, mentionTrigger.query, mentionOpen])

  const insertAndRestoreCaret = useCallback(
    (text: string, selection: number): void => {
      setContent(text)
      setCaret(selection)
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(selection, selection)
      })
    },
    [setContent, setCaret, textareaRef],
  )

  const onSelect = useCallback(
    (entity: Entity): void => {
      const result = insertMentionToken(content, mentionTrigger, entity)
      insertAndRestoreCaret(result.text, result.selection)
      setHighlight(0)
      dismissMention(mentionTrigger.start)
      announce(mentionsT('mentions.announce.inserted', entity.name))
    },
    [content, mentionTrigger, insertAndRestoreCaret, dismissMention, announce],
  )

  const onCreate = useCallback((): void => {
    if (!showCreate) return
    const stub = buildStubEntity(trimmedQuery, entityType)
    commitEntities([stub])
    const result = insertMentionToken(content, mentionTrigger, stub)
    insertAndRestoreCaret(result.text, result.selection)
    setHighlight(0)
    dismissMention(mentionTrigger.start)
    announce(mentionsT('mentions.announce.created', stub.name))
  }, [showCreate, trimmedQuery, entityType, commitEntities, content, mentionTrigger, insertAndRestoreCaret, dismissMention, announce])

  const onHighlight = useCallback((index: number): void => {
    setHighlight(index)
  }, [])

  const onHighlightCreate = useCallback((): void => {
    setHighlight(candidates.length)
  }, [candidates.length])

  const onBlur = useCallback((): void => {
    if (mentionTrigger.active) dismissMention(mentionTrigger.start)
  }, [mentionTrigger, dismissMention])

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
      if (!mentionOpen) return
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissMention(mentionTrigger.start)
        return
      }
      if (totalOptions === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((i) => (i + 1) % totalOptions)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((i) => (i - 1 + totalOptions) % totalOptions)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (createHighlighted) {
          onCreate()
          return
        }
        const candidate = candidates.at(highlight)
        if (candidate !== undefined) onSelect(candidate)
      }
    },
    [mentionOpen, totalOptions, createHighlighted, candidates, highlight, onCreate, onSelect, dismissMention, mentionTrigger.start],
  )

  return {
    mentionTrigger,
    mentionOpen,
    candidates,
    highlight,
    createHighlighted,
    showCreate,
    createLabel,
    createAriaLabel,
    activeDescendantId: totalOptions > 0 ? mentionOptionId(highlight) : undefined,
    onHighlight,
    onHighlightCreate,
    onSelect,
    onCreate,
    onBlur,
    handleKeyDown,
  }
}
