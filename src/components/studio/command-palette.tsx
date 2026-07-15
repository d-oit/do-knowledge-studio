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
import type { ViewId, EntityType } from '@/lib/studio/types'
import { ENTITY_TYPE_META } from '@/lib/studio/types'

interface CmdItem {
  id: string
  label: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  onSelect: () => void
  group: 'Navigate' | 'Create' | 'Library'
}

export function CommandPalette() {
  const commandOpen = useStudioStore((s) => s.commandOpen)
  const setCommandOpen = useStudioStore((s) => s.setCommandOpen)
  const setView = useStudioStore((s) => s.setView)
  const startNew = useStudioStore((s) => s.startNew)
  const entities = useStudioStore((s) => s.entities)
  const startEdit = useStudioStore((s) => s.startEdit)
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
      if (e.key === 'Escape' && commandOpen) close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandOpen, setCommandOpen, close])

  const goTo = (v: ViewId) => {
    setView(v)
    close()
  }

  const navItems: CmdItem[] = [
    { id: 'nav-home', label: 'Home', icon: Home, onSelect: () => { goTo('home') }, group: 'Navigate' },
    { id: 'nav-editor', label: 'Editor', icon: FileText, onSelect: () => { goTo('editor') }, group: 'Navigate' },
    { id: 'nav-library', label: 'Library', icon: Library, onSelect: () => { goTo('library') }, group: 'Navigate' },
    { id: 'nav-graph', label: 'Graph', icon: GitBranch, onSelect: () => { goTo('graph') }, group: 'Navigate' },
    { id: 'nav-mindmap', label: 'Mind Map', icon: BrainCircuit, onSelect: () => { goTo('mindmap') }, group: 'Navigate' },
    { id: 'nav-chat', label: 'Chat', icon: MessageSquare, onSelect: () => { goTo('chat') }, group: 'Navigate' },
    { id: 'nav-ai', label: 'AI Harness', icon: FlaskConical, onSelect: () => { goTo('ai') }, group: 'Navigate' },
    { id: 'nav-triz', label: 'TRIZ Matrix', icon: Grid3X3, onSelect: () => { goTo('triz') }, group: 'Navigate' },
    { id: 'nav-export', label: 'Export', icon: Download, onSelect: () => { goTo('export') }, group: 'Navigate' },
    {
      id: 'create-entity',
      label: 'Create new entity',
      hint: 'Opens the Editor',
      icon: FileText,
      onSelect: () => {
        startNew()
        close()
      },
      group: 'Create',
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
      hint: ENTITY_TYPE_META[e.type as EntityType].label,
      icon: FileText,
      onSelect: () => {
        startEdit(e.id)
        close()
      },
      group: 'Library',
    }))

  const allItems = [...navItems, ...libItems]
  const grouped = allItems.reduce(
    (acc, item) => {
      ;(acc[item.group] ||= []).push(item)
      return acc
    },
    {} as Record<string, CmdItem[]>,
  )

  if (!commandOpen) return null

  return (
    <div role="dialog" aria-modal="true" aria-label="Command palette" className="fixed inset-0 z-[900] flex items-start justify-center bg-ink/30 backdrop-blur-sm animate-in fade-in duration-150">
      <CommandPrimitive
        className="mt-[12vh] w-[640px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        loop
        label="Command palette"
        shouldFilter={false}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-ink-faint" />
          <CommandPrimitive.Input
            autoFocus
            placeholder="Search commands and entities…"
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
            No matches.
          </CommandPrimitive.Empty>
          {Object.entries(grouped).map(([group, items]) =>
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
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span className="font-mono">{allItems.length} results</span>
        </div>
      </CommandPrimitive>
    </div>
  )
}
