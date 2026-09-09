'use client'

import { memo, useLayoutEffect, useState, type RefObject } from 'react'
import { AtSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Entity } from '@/lib/studio/types'
import { getEntityTypeMeta } from '@/lib/studio/entity-types'
import { t as mentionsT } from '@/lib/i18n/messages/mentions'

/**
 * @mention autocomplete listbox (N3, issue #753).
 *
 * Lightweight custom listbox (not cmdk): the input IS the controlled
 * textarea, so a cmdk Command root with its own input/focus model would fight
 * the editor. Keyboard interaction lives on the textarea (combobox +
 * aria-activedescendant pattern); this component is presentational: it
 * renders the positioned popover for the current trigger/query state.
 */

/** Maximum number of suggestion rows shown in the popover. */
export const MENTION_MAX_RESULTS = 6

/** Listbox id referenced by the textarea's `aria-controls`. */
export const MENTION_LISTBOX_ID = 'editor-mention-listbox'

/** Popover width in px — used to clamp the horizontal position. */
const PICKER_WIDTH = 288
/** Vertical gap (px) between the caret line and the popover. */
const PICKER_CARET_GAP = 6
/** Estimated height (px) of one suggestion row, for flip-up estimation. */
const PICKER_ROW_HEIGHT = 44
/** Estimated popover chrome (padding + hint row) for flip-up estimation. */
const PICKER_CHROME_HEIGHT = 64
/** Fallback line height used when computed styles are unavailable (jsdom). */
const FALLBACK_LINE_HEIGHT = 28
/** Minimum popover inset from the wrapper edges. */
const PICKER_MIN_INSET = 4

/** Stable option id for a suggestion index (aria-activedescendant target). */
export const mentionOptionId = (index: number): string => `editor-mention-option-${index}`

interface PickerPosition {
  top: number
  left: number
}

/**
 * Measures the caret's content-box position by rendering the text before it
 * into a hidden div that mirrors the textarea's font, width, and padding,
 * then reading a zero-width marker span's offset. Returns the line's top-left
 * plus line height so the caller can place the popover below (or above when
 * flipping).
 */
const measureCaretLine = (
  textarea: HTMLTextAreaElement,
  content: string,
  caret: number,
): { lineLeft: number; lineTop: number; lineHeight: number } | null => {
  const computed = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  mirror.style.cssText = [
    'position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;',
    'white-space:pre-wrap;overflow-wrap:break-word;',
    `width:${textarea.clientWidth}px;`,
    `font-family:${computed.fontFamily};`,
    `font-size:${computed.fontSize};`,
    `line-height:${computed.lineHeight};`,
    `letter-spacing:${computed.letterSpacing};`,
    `padding:${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft};`,
    'box-sizing:border-box;',
  ].join('')
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.appendChild(document.createTextNode(content.slice(0, caret)))
  mirror.appendChild(marker)
  mirror.appendChild(document.createTextNode(' '))
  document.body.appendChild(mirror)
  try {
    const lineHeight = parseFloat(computed.lineHeight) || FALLBACK_LINE_HEIGHT
    return { lineLeft: marker.offsetLeft, lineTop: marker.offsetTop, lineHeight }
  } finally {
    document.body.removeChild(mirror)
  }
}

/** Height the popover will occupy for a given visible row count. */
const estimatePopoverHeight = (rowCount: number): number =>
  PICKER_CHROME_HEIGHT + rowCount * PICKER_ROW_HEIGHT

interface EditorMentionPickerProps {
  /** Whether the popover should be shown (trigger active + not dismissed). */
  open: boolean
  /** Current query text after the '@' (filtering lives in the caller). */
  query: string
  /** Suggestion rows — already filtered, capped at MENTION_MAX_RESULTS. */
  candidates: Entity[]
  /** Index of the highlighted option (aria-activedescendant + styles). */
  highlightedIndex: number
  /** Index in `content` of the '@' that started the trigger (caret anchor). */
  triggerStart: number
  /** Full editor content (for caret measurement). */
  content: string
  /** Ref to the textarea the popover anchors to (`.current` read in the layout effect). */
  textarea: RefObject<HTMLTextAreaElement | null>
  /** Called with the new index when the pointer hovers an option. */
  onHighlight: (index: number) => void
  /** Called with the entity when an option is activated (click/Enter). */
  onSelect: (entity: Entity) => void
}

/** Popover listing mentionable entities, anchored near the caret. */
export const EditorMentionPicker = memo(function EditorMentionPicker({
  open,
  query,
  candidates,
  highlightedIndex,
  triggerStart,
  content,
  textarea,
  onHighlight,
  onSelect,
}: EditorMentionPickerProps) {
  const [position, setPosition] = useState<PickerPosition>({ top: PICKER_MIN_INSET, left: PICKER_MIN_INSET })
  const caret = triggerStart + 1 + query.length

  useLayoutEffect(() => {
    const el = textarea.current
    if (!open || !el) return
    const measure = () => {
      const measured = measureCaretLine(el, content, caret)
      if (!measured) return
      const rowCount = Math.max(candidates.length, 1)
      const popoverHeight = estimatePopoverHeight(rowCount)
      // The mirror measures in unscrolled document coordinates; the picker is
      // positioned inside the textarea's scrolling viewport, so subtract the
      // current scrollTop before comparing/placing.
      const viewTop = measured.lineTop - el.scrollTop
      const fitsBelow =
        viewTop + measured.lineHeight + PICKER_CARET_GAP + popoverHeight <= el.clientHeight
      const top = fitsBelow
        ? viewTop + measured.lineHeight + PICKER_CARET_GAP
        : viewTop - popoverHeight
      const maxLeft = Math.max(PICKER_MIN_INSET, el.clientWidth - PICKER_WIDTH)
      const left = Math.min(Math.max(measured.lineLeft, PICKER_MIN_INSET), maxLeft)
      setPosition({ top: Math.max(PICKER_MIN_INSET, top), left })
    }
    // Native textarea scrolling mutates scrollTop without any React render,
    // so a plain effect would leave the popover at its pre-scroll coordinate.
    // Re-measure on scroll while the picker stays open; cleanup on close.
    el.addEventListener('scroll', measure, { passive: true })
    measure()
    return () => el.removeEventListener('scroll', measure)
  }, [open, textarea, content, caret, candidates.length, query, triggerStart])

  if (!open) return null

  return (
    <div
      id={MENTION_LISTBOX_ID}
      role="listbox"
      aria-label={mentionsT('mentions.picker.ariaLabel')}
      style={{ top: position.top, left: position.left, width: PICKER_WIDTH }}
      className="absolute z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-lifted"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <AtSign className="h-3.5 w-3.5 text-ink-faint" />
        <span className="text-label text-ink-faint">{mentionsT('mentions.picker.hint')}</span>
      </div>
      {candidates.length === 0 ? (
        <div className="px-3 py-4 text-center text-body-sm text-ink-mute">
          {mentionsT('mentions.picker.empty')}
        </div>
      ) : (
        <ul className="max-h-64 overflow-y-auto p-1">
          {candidates.map((entity, index) => {
            const meta = getEntityTypeMeta(entity.type)
            const highlighted = index === highlightedIndex
            return (
              <li
                key={entity.id}
                id={mentionOptionId(index)}
                role="option"
                aria-selected={highlighted}
                aria-label={mentionsT('mentions.picker.option', entity.name, meta.label)}
                onMouseDown={(e) => { e.preventDefault() }}
                onMouseEnter={() => { onHighlight(index) }}
                onClick={() => { onSelect(entity) }}
                className={cn(
                  'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md px-3 text-body-sm transition-colors',
                  highlighted ? 'bg-saffron-soft text-saffron-deep' : 'text-ink-soft',
                )}
              >
                <span className="truncate">{entity.name}</span>
                <span className="ml-auto shrink-0 text-caption text-ink-faint">{meta.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})