'use client'

import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnyEntityType } from '@/lib/studio/types'
import { getEntityTypeDefs, getEntityTypeMeta } from '@/lib/studio/entity-types'
import { translate as entityTypesT } from '@/lib/i18n/messages/entity-types'
import { EntityIcon } from '../entity-type-icon'

/**
 * Moves listbox keyboard focus to the option adjacent to the currently focused
 * one, wrapping around at the ends. No-op when there are no options.
 */
const focusAdjacentOption = (
  menuEl: HTMLDivElement | null,
  direction: 'next' | 'previous',
): void => {
  const options = menuEl?.querySelectorAll<HTMLElement>('[role="option"]')
  if (!options?.length) return
  const currentIdx = Array.from(options).findIndex((o) => o === document.activeElement)
  const nextIdx =
    direction === 'next'
      ? (currentIdx + 1) % options.length
      : (currentIdx - 1 + options.length) % options.length
  // nextIdx is always within [0, options.length) via the modulo above, and the
  // non-empty guard runs earlier — .item() is safe to call directly.
  options.item(nextIdx).focus()
}

/** Dropdown selector for choosing an entity type with keyboard navigation. */
export const TypeSelector = ({
  type,
  showMenu,
  onToggleMenu,
  onSelect,
}: {
  type: AnyEntityType
  showMenu: boolean
  onToggleMenu: () => void
  onSelect: (t: AnyEntityType) => void
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const meta = getEntityTypeMeta(type)
  const typeDefs = getEntityTypeDefs()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (showMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
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
        aria-label={entityTypesT('entity-types.selectorLabel', meta.label)}
        className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
      >
        <EntityIcon type={type} className={cn('h-3.5 w-3.5', meta.text)} />
        {entityTypesT('entity-types.typePrefix', meta.label)}
        <ChevronDown className="h-3 w-3" />
      </button>
      {showMenu && (
        <div
          role="listbox"
          aria-label={entityTypesT('entity-types.listboxLabel')}
          className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-lg"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onToggleMenu()
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              focusAdjacentOption(menuRef.current, e.key === 'ArrowDown' ? 'next' : 'previous')
            }
          }}
        >
          {typeDefs.map((def) => {
            const meta = getEntityTypeMeta(def.id)
            return (
              <button
                key={def.id}
                role="option"
                aria-selected={type === def.id}
                type="button"
                tabIndex={def.id === type ? 0 : -1}
                onClick={() => { onSelect(def.id) }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] transition-colors hover:bg-muted focus-ring',
                  def.id === type ? 'font-semibold text-ink' : 'text-ink-soft',
                )}
              >
                <EntityIcon type={def.id} className={cn('h-3.5 w-3.5', meta.text)} />
                {meta.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}