'use client'

import { useEffect, useRef } from 'react'
import { ChevronDown, FileText, Lightbulb, User, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENTITY_TYPE_META, type EntityType } from '@/lib/studio/types'

const ENTITY_TYPES: EntityType[] = ['note', 'concept', 'person', 'project']

/** Returns the entity type metadata (label, colors) for a given type. */
function getTypeMeta(t: EntityType) {
  switch (t) {
    case 'note': return ENTITY_TYPE_META.note
    case 'concept': return ENTITY_TYPE_META.concept
    case 'person': return ENTITY_TYPE_META.person
    case 'project': return ENTITY_TYPE_META.project
    default: return ENTITY_TYPE_META.note
  }
}

/** Renders the appropriate Lucide icon for an entity type. */
function renderTypeIcon(t: EntityType, className?: string) {
  switch (t) {
    case 'note': return <FileText className={className} />
    case 'concept': return <Lightbulb className={className} />
    case 'person': return <User className={className} />
    case 'project': return <FolderKanban className={className} />
    default: return <FileText className={className} />
  }
}

/** Dropdown selector for choosing an entity type with keyboard navigation. */
export function TypeSelector({
  type,
  showMenu,
  onToggleMenu,
  onSelect,
}: {
  type: EntityType
  showMenu: boolean
  onToggleMenu: () => void
  onSelect: (t: EntityType) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const meta = getTypeMeta(type)

  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggleMenu()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => { document.removeEventListener('mousedown', handleClick) }
  }, [showMenu, onToggleMenu])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={onToggleMenu}
        aria-haspopup="listbox"
        aria-expanded={showMenu}
        aria-label={`Entity type: ${meta.label}. Change type`}
        className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
      >
        {renderTypeIcon(type, cn('h-3.5 w-3.5', meta.text))}
        Type: {meta.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {showMenu && (
        <div
          role="listbox"
          aria-label="Select entity type"
          className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-lg"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onToggleMenu()
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              const options = menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
              if (!options?.length) return
              const currentIdx = Array.from(options).findIndex((o) => o === document.activeElement)
              const nextIdx = e.key === 'ArrowDown'
                ? (currentIdx + 1) % options.length
                : (currentIdx - 1 + options.length) % options.length
              // nextIdx is always within [0, options.length) via the modulo above.
              options[nextIdx].focus()
            }
          }}
        >
          {ENTITY_TYPES.map((t) => {
            const m = getTypeMeta(t)
            return (
              <button
                key={t}
                role="option"
                aria-selected={type === t}
                type="button"
                tabIndex={t === type ? 0 : -1}
                onClick={() => { onSelect(t) }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] transition-colors hover:bg-muted focus-ring',
                  t === type ? 'font-semibold text-ink' : 'text-ink-soft',
                )}
              >
                {renderTypeIcon(t, cn('h-3.5 w-3.5', m.text))}
                {m.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}