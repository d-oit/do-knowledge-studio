'use client'

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
  Sun,
  Moon,
  Search,
  PanelRight,
  PanelRightClose,
  Wifi,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useStudioStore } from '@/lib/studio/store'
import type { ViewId } from '@/lib/studio/types'
import { cn } from '@/lib/utils'
import { ShortcutsTrigger } from './shortcuts-dialog'

interface NavItem {
  id: ViewId
  label: string
  icon: typeof Home
  shortcut?: string
  experimental?: boolean
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ id: 'home', label: 'Home', icon: Home, shortcut: 'G H' }],
  },
  {
    label: 'Capture',
    items: [{ id: 'editor', label: 'Editor', icon: FileText, shortcut: 'G E' }],
  },
  {
    label: 'Explore',
    items: [
      { id: 'library', label: 'Library', icon: Library, shortcut: 'G L' },
      { id: 'graph', label: 'Graph', icon: GitBranch, shortcut: 'G G' },
      { id: 'mindmap', label: 'Mind Map', icon: BrainCircuit, shortcut: 'G M' },
    ],
  },
  {
    label: 'Ask',
    items: [{ id: 'chat', label: 'Chat', icon: MessageSquare, shortcut: 'G C' }],
  },
  {
    label: 'Lab',
    items: [
      { id: 'ai', label: 'AI Harness', icon: FlaskConical, shortcut: 'G A', experimental: true },
      { id: 'triz', label: 'TRIZ Matrix', icon: Grid3X3, shortcut: 'G T', experimental: true },
    ],
  },
  {
    label: 'Data',
    items: [
      { id: 'sync', label: 'Sync', icon: Wifi, shortcut: 'G S' },
      { id: 'export', label: 'Export', icon: Download, shortcut: 'G X' },
    ],
  },
]

export function Sidebar() {
  const { currentView, setView, setCommandOpen, rightPanelOpen, setRightPanelOpen } =
    useStudioStore()
  const { theme, setTheme } = useTheme()

  return (
    <aside className="hidden h-full w-[248px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground lg:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <img src="/logo.svg" alt="" className="h-9 w-9" />
        <div className="flex flex-col">
          <span className="font-serif text-[15px] font-semibold leading-tight tracking-tight">
            Knowledge Studio
          </span>
          <span className="text-caption uppercase tracking-[0.14em] text-ink-faint">
            Local-first · v0.2
          </span>
        </div>
      </div>

      {/* Search trigger */}
      <div className="px-3 pb-3">
        <button
          onClick={() => { setCommandOpen(true) }}
          className="group flex w-full items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-left text-[13px] text-ink-mute transition-colors hover:border-saffron/40 hover:text-ink-soft focus-ring min-h-[44px]"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search…</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-caption text-ink-faint">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="mb-1.5 px-2 text-caption font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = currentView === item.id
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => { setView(item.id) }}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-md px-2.5 min-h-[44px] text-[13px] font-medium transition-all press-scale focus-ring',
                        active
                          ? 'bg-saffron-soft text-saffron-deep'
                          : 'text-ink-soft hover:bg-sidebar-accent hover:text-ink',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          active ? 'text-saffron' : 'text-ink-faint group-hover:text-ink-soft',
                        )}
                      />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.experimental && (
                        <span className="rounded-full border border-dashed border-saffron/40 px-1.5 py-0 text-badge font-semibold uppercase tracking-wide text-saffron-deep">
                          Lab
                        </span>
                      )}
                      {item.shortcut && !item.experimental && (
                        <kbd className="hidden font-mono text-badge text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 lg:inline">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-2.5">
        <button
          onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark') }}
          className="flex items-center gap-2 rounded-md px-2.5 min-h-[44px] text-[12px] font-medium text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              <span>Dark</span>
            </>
          )}
        </button>
        <ShortcutsTrigger
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 min-h-[44px] text-[12px] font-medium text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring',
          )}
        />
        <div className="flex-1" />
        <button
          onClick={() => { setRightPanelOpen(!rightPanelOpen) }}
          className="rounded-md p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring"
          aria-label={rightPanelOpen ? 'Hide panel' : 'Show panel'}
          title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
        >
          {rightPanelOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRight className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  )
}
