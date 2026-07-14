'use client'

import { useEffect, useRef } from 'react'
import { ChevronDown, FileText, Lightbulb, User, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENTITY_TYPE_META, type EntityType } from '@/lib/studio/types'

const TYPE_ICONS: Record<EntityType, typeof FileText> = {
  note: FileText,
  concept: Lightbulb,
  person: User,
  project: FolderKanban,
}

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
  const meta = ENTITY_TYPE_META[type]
  const TypeIcon = TYPE_ICONS[type]

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
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
      >
        <TypeIcon className={cn('h-3.5 w-3.5', meta.text)} />
        Type: {meta.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {showMenu && (
        <div
          role="listbox"
          aria-label="Select entity type"
          className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {(Object.keys(ENTITY_TYPE_META) as EntityType[]).map((t) => {
            const m = ENTITY_TYPE_META[t]
            const Icon = TYPE_ICONS[t]
            return (
              <button
                key={t}
                role="option"
                aria-selected={type === t}
                type="button"
                onClick={() => { onSelect(t) }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] transition-colors hover:bg-muted focus-ring',
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
  )
}