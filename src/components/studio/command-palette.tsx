'use client'

import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import {
  Home,
  FileText,
  Library,
  GitBranch,
  BrainCircuit,
  MessageSquare,
  FlaskConical,
  Grid3X3,
  Download,
  Search,
  CornerDownLeft,
} from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import type { ViewId } from '@/lib/studio/types'
import { getEntityTypeMeta } from '@/lib/studio/entity-types'
import { translate } from '@/lib/i18n/messages/palette'

interface CmdItem {
  id: string
  label: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  onSelect: () => void
  group: string
}

interface CommandPaletteProps {
  onEntitySelect: (entityId: string) => void
}

/** Command palette overlay for navigating views, creating entities, and searching the library. */
export const CommandPalette = ({ onEntitySelect }: CommandPaletteProps) => {
  const commandOpen = useStudioStore((s) => s.commandOpen)
  const setCommandOpen = useStudioStore((s) => s.setCommandOpen)
  const setView = useStudioStore((s) => s.setView)
  const startNew = useStudioStore((s) => s.startNew)
  const entities = useStudioStore((s) => s.entities)
  const [query, setQuery] = React.useState('')

  const close = React.useCallback(() => {
    setCommandOpen(false)
    setQuery('')
  }, [setCommandOpen])

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(!commandOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [commandOpen, setCommandOpen])

  const goTo = (v: ViewId) => {
    setView(v)
    close()
  }

  const navItems: CmdItem[] = [
    { id: 'nav-home', label: translate('palette.nav.home'), icon: Home, onSelect: () => { goTo('home') }, group: translate('palette.group.navigate') },
    { id: 'nav-editor', label: translate('palette.nav.editor'), icon: FileText, onSelect: () => { goTo('editor') }, group: translate('palette.group.navigate') },
    { id: 'nav-library', label: translate('palette.nav.library'), icon: Library, onSelect: () => { goTo('library') }, group: translate('palette.group.navigate') },
    { id: 'nav-graph', label: translate('palette.nav.graph'), icon: GitBranch, onSelect: () => { goTo('graph') }, group: translate('palette.group.navigate') },
    { id: 'nav-mindmap', label: translate('palette.nav.mindmap'), icon: BrainCircuit, onSelect: () => { goTo('mindmap') }, group: translate('palette.group.navigate') },
    { id: 'nav-chat', label: translate('palette.nav.chat'), icon: MessageSquare, onSelect: () => { goTo('chat') }, group: translate('palette.group.navigate') },
    { id: 'nav-ai', label: translate('palette.nav.ai'), icon: FlaskConical, onSelect: () => { goTo('ai') }, group: translate('palette.group.navigate') },
    { id: 'nav-triz', label: translate('palette.nav.triz'), icon: Grid3X3, onSelect: () => { goTo('triz') }, group: translate('palette.group.navigate') },
    { id: 'nav-export', label: translate('palette.nav.export'), icon: Download, onSelect: () => { goTo('export') }, group: translate('palette.group.navigate') },
    {
      id: 'create-entity',
      label: translate('palette.create.label'),
      hint: translate('palette.create.hint'),
      icon: FileText,
      onSelect: () => {
        startNew()
        close()
      },
      group: translate('palette.group.create'),
    },
  ]

  const libItems: CmdItem[] = entities
    .filter(
      (e) =>
        !query ||
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.description.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 6)
    .map((e) => ({
      id: `lib-${e.id}`,
      label: e.name,
      hint: getEntityTypeMeta(e.type).label,
      icon: FileText,
      onSelect: () => {
        onEntitySelect(e.id)
        close()
      },
      group: translate('palette.group.library'),
    }))

  const allItems = [...navItems, ...libItems]
  const grouped = allItems.reduce(
    (acc, item) => {
      const list = acc.get(item.group) ?? []
      list.push(item)
      acc.set(item.group, list)
      return acc
    },
    new Map<string, CmdItem[]>(),
  )

  if (!commandOpen) return null

  return (
    <Overlay open={commandOpen} onClose={close} aria-label={translate('palette.ariaLabel')} variant="center" className="mt-[12vh] w-[640px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
      <CommandPrimitive
        loop
        label={translate('palette.ariaLabel')}
        shouldFilter={false}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-ink-faint" />
          <CommandPrimitive.Input
            autoFocus
            placeholder={translate('palette.inputPlaceholder')}
            value={query}
            onValueChange={setQuery}
            className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-caption text-ink-faint">
            ESC
          </kbd>
        </div>
        <CommandPrimitive.List className="max-h-[420px] overflow-y-auto p-2">
          <CommandPrimitive.Empty className="px-3 py-6 text-center text-[13px] text-ink-mute">
            {translate('palette.empty')}
          </CommandPrimitive.Empty>
          {[...grouped].map(([group, items]) =>
            items.length ? (
              <CommandPrimitive.Group
                key={group}
                heading={group}
                className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-ink-faint"
              >
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandPrimitive.Item
                      key={item.id}
                      value={item.id + item.label}
                      onSelect={item.onSelect}
                      className="group flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-[13px] text-ink-soft data-[selected=true]:bg-saffron-soft data-[selected=true]:text-saffron-deep"
                    >
                      <Icon className="h-4 w-4 text-ink-faint data-[selected=true]:text-saffron" />
                      <span className="flex-1 font-medium">{item.label}</span>
                      {item.hint && (
                        <span className="text-label text-ink-faint">{item.hint}</span>
                      )}
                      <CornerDownLeft className="h-3 w-3 text-ink-faint opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
                    </CommandPrimitive.Item>
                  )
                })}
              </CommandPrimitive.Group>
            ) : null,
          )}
        </CommandPrimitive.List>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-label text-ink-faint">
          <span>{translate('palette.footer.hints')}</span>
          <span className="font-mono">{translate('palette.footer.results', String(allItems.length))}</span>
        </div>
      </CommandPrimitive>
    </Overlay>
  )
}
