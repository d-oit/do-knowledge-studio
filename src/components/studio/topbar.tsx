'use client'

import { useStudioStore } from '@/lib/studio/store'
import { useIsMacPlatform, formatShortcut } from '@/lib/studio/use-platform-shortcut'
import type { ViewId } from '@/lib/studio/types'
import { translate as navT } from '@/lib/i18n/messages/nav'
import { translate as timelineT } from '@/lib/i18n/messages/timeline'
import { Menu, Plus, Search, X } from 'lucide-react'
import type { KeyboardEvent } from 'react'

/** Home metadata, reused as the fallback for unknown view ids. */
const HOME_META: { title: string; subtitle: string } = {
  title: navT('nav.home.title'),
  subtitle: navT('nav.home.subtitle'),
}

/** View title metadata keyed by ViewId (bounded Map retrieval — no dynamic indexing). */
const VIEW_TITLES: ReadonlyMap<ViewId, { title: string; subtitle: string }> = new Map([
  ['home', HOME_META],
  ['editor', { title: navT('nav.editor.title'), subtitle: navT('nav.editor.subtitle') }],
  ['library', { title: navT('nav.library.title'), subtitle: navT('nav.library.subtitle') }],
  ['graph', { title: navT('nav.graph.title'), subtitle: navT('nav.graph.subtitle') }],
  ['mindmap', { title: navT('nav.mindmap.title'), subtitle: navT('nav.mindmap.subtitle') }],
  ['chat', { title: navT('nav.chat.title'), subtitle: navT('nav.chat.subtitle') }],
  ['ai', { title: navT('nav.ai.title'), subtitle: navT('nav.ai.subtitle') }],
  ['triz', { title: navT('nav.triz.title'), subtitle: navT('nav.triz.subtitle') }],
  ['export', { title: navT('nav.export.title'), subtitle: navT('nav.export.subtitle') }],
  ['sync', { title: navT('nav.sync.title'), subtitle: navT('nav.sync.subtitle') }],
  ['timeline', { title: timelineT('timeline.title'), subtitle: timelineT('timeline.subtitle') }],
])

/** Bounded lookup; falls back to the home title for unknown view ids. */
const getViewMeta = (view: ViewId): { title: string; subtitle: string } =>
  VIEW_TITLES.get(view) ?? HOME_META

/** Top header bar with view title, inline search, offline badge, and new entity button. */
export const Topbar = () => {
  const isMacPlatform = useIsMacPlatform()
  const currentView = useStudioStore((s) => s.currentView)
  const searchQuery = useStudioStore((s) => s.searchQuery)
  const startNew = useStudioStore((s) => s.startNew)
  const setCommandOpen = useStudioStore((s) => s.setCommandOpen)
  const setSearchQuery = useStudioStore((s) => s.setSearchQuery)
  const setMobileDrawerOpen = useStudioStore((s) => s.setMobileDrawerOpen)
  const setMobilePanelView = useStudioStore((s) => s.setMobilePanelView)
  const meta = getViewMeta(currentView)

  // Inline input doubles as a quick filter for the Library + right-panel SearchPanel,
  // and as a launcher for the command palette (via ⌘K or the kbd chip).
  const isLibraryView = currentView === 'library'
  const placeholder = isLibraryView ? 'Filter library…' : 'Search…'
  const inputAriaLabel = isLibraryView ? 'Filter library' : 'Search'

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCommandOpen(true)
    } else if (e.key === 'Escape' && searchQuery) {
      e.preventDefault()
      setSearchQuery('')
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
      className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-sm sm:gap-3 sm:px-5"
    >
      {/* Mobile menu + search triggers — visible only below lg (matches the
          desktop Sidebar's `hidden lg:flex`). The menu opens the drawer on
          the Navigate tab; the search icon opens it on the Search tab. */}
      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="flex size-touch flex-shrink-0 items-center justify-center rounded-md p-2 text-ink-soft hover:bg-muted focus-ring lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        onClick={openMobileSearch}
        className="flex size-touch flex-shrink-0 items-center justify-center rounded-md p-2 text-ink-soft hover:bg-muted focus-ring lg:hidden"
        aria-label="Search knowledge base"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Title / subtitle column — min-w-0 + flex-1 + truncate so it never overflows */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate font-serif text-base font-semibold leading-tight tracking-tight text-ink sm:text-xl">
          {meta.title}
        </h1>
        <p className="hidden truncate text-label-lg text-ink-mute sm:block">
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
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={placeholder}
          aria-label={inputAriaLabel}
          className="min-h-touch w-full rounded-md border border-border bg-background pl-9 pr-20 text-body-sm text-ink placeholder:text-ink-faint transition-colors focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/40"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear quick filter"
            title="Clear quick filter"
            className="absolute right-[3.25rem] top-1/2 flex min-h-touch min-w-touch items-center justify-center -translate-y-1/2 rounded text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Open command palette"
          className="absolute right-1.5 top-1/2 flex min-h-touch min-w-touch items-center justify-center -translate-y-1/2 rounded border border-border bg-muted px-1.5 font-mono text-caption md:text-badge text-ink-faint transition-colors hover:bg-muted/70 hover:text-ink-soft focus-ring overflow-hidden"
        >
          {formatShortcut('⌘K', isMacPlatform)}
        </button>
      </div>

      {/* New entity button — icon-only on mobile, "New" on md–lg, "New entity" on wide (≥ 1100px) */}
      <button
        onClick={startNew}
        aria-label="New entity"
        className="flex flex-shrink-0 min-h-touch items-center gap-1.5 rounded-md bg-primary px-2.5 text-label-lg font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring sm:px-3"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline wide:hidden">New</span>
        <span className="hidden wide:inline">New entity</span>
      </button>
    </header>
  )
}
