'use client'

import { useStudioStore } from '@/lib/studio/store'
import type { ViewId } from '@/lib/studio/types'
import { Menu, Plus, Search } from 'lucide-react'
import type { KeyboardEvent } from 'react'

const VIEW_TITLES: Record<ViewId, { title: string; subtitle: string }> = {
  home: { title: 'Studio', subtitle: 'Your knowledge base at a glance' },
  editor: { title: 'Editor', subtitle: 'Capture a thought, claim, or note' },
  library: { title: 'Library', subtitle: 'Browse and filter your entities' },
  graph: { title: 'Graph', subtitle: 'Visualize relationships' },
  mindmap: { title: 'Mind Map', subtitle: 'Hierarchical exploration' },
  chat: { title: 'Chat', subtitle: 'Ask your library' },
  ai: { title: 'AI Harness', subtitle: 'Configure and chat with LLMs' },
  triz: { title: 'TRIZ Matrix', subtitle: 'Solve inventive contradictions' },
  export: { title: 'Export', subtitle: 'Backup and share your knowledge' },
}

export function Topbar() {
  const {
    currentView,
    startNew,
    setCommandOpen,
    searchQuery,
    setSearchQuery,
    setMobileDrawerOpen,
    setMobilePanelView,
  } = useStudioStore()
  const meta = VIEW_TITLES[currentView]

  // Inline input doubles as a quick filter for the Library + right-panel SearchPanel,
  // and as a launcher for the command palette (via ⌘K or the kbd chip).
  const isLibraryView = currentView === 'library'
  const placeholder = isLibraryView ? 'Filter library…' : 'Search…'
  const inputAriaLabel = isLibraryView ? 'Filter library' : 'Search'

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCommandOpen(true)
    }
  }

  // Open the drawer directly on the Search tab — fixes mobile search reachability
  // (research pain point #35).
  const openMobileSearch = () => {
    setMobilePanelView('search')
    setMobileDrawerOpen(true)
  }

  return (
    <header
      className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-sm sm:gap-3 sm:px-5"
      style={{ height: 'var(--header-height, 4rem)' }}
    >
      {/* Mobile menu + search triggers — visible only below lg (matches the
          desktop Sidebar's `hidden lg:flex`). The menu opens the drawer on
          the Navigate tab; the search icon opens it on the Search tab. */}
      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="flex-shrink-0 rounded-md p-2 text-ink-soft hover:bg-muted focus-ring lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        onClick={openMobileSearch}
        className="flex-shrink-0 rounded-md p-2 text-ink-soft hover:bg-muted focus-ring lg:hidden"
        aria-label="Search knowledge base"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Title / subtitle column — min-w-0 + flex-1 + truncate so it never overflows */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate font-serif text-base font-semibold leading-tight tracking-tight text-ink sm:text-xl">
          {meta.title}
        </h1>
        <p className="hidden truncate text-[12px] text-ink-mute sm:block">
          {meta.subtitle}
        </p>
      </div>

      {/* Inline quick-filter input — visible at lg+ (≥ 1024px) */}
      <div className="relative hidden w-60 flex-shrink-0 items-center lg:flex">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={placeholder}
          aria-label={inputAriaLabel}
          className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-12 text-[13px] text-ink placeholder:text-ink-faint transition-colors focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/40"
        />
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Open command palette"
          className="absolute right-1.5 top-1/2 flex h-6 -translate-y-1/2 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-ink-faint transition-colors hover:bg-muted/70 hover:text-ink-soft focus-ring"
        >
          ⌘K
        </button>
      </div>

      {/* Offline-ready badge — hidden on mobile (< 768px) */}
      <div className="hidden flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 md:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Offline ready
      </div>

      {/* New entity button — icon-only on mobile, "New" on md–lg, "New entity" on wide (≥ 1100px) */}
      <button
        onClick={startNew}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 focus-ring sm:px-3"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline wide:hidden">New</span>
        <span className="hidden wide:inline">New entity</span>
      </button>
    </header>
  )
}
