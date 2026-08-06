'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import { X, Search, Sun, Moon, FileText } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useStudioStore, useFilteredEntities } from '@/lib/studio/store'
import { ENTITY_TYPE_META, type Entity } from '@/lib/studio/types'
import { NAV_GROUPS } from './sidebar'
import { cn } from '@/lib/utils'
import { search } from '@/lib/search/retrieval'

/**
 * MobileDrawer — slide-in drawer from the left, visible only below `lg`
 * (1024px). Provides the same navigation as the desktop Sidebar plus a
 * Search tab that reuses the store's `searchQuery` and `useFilteredEntities`
 * selector, and a theme toggle in the footer (fixes the mobile theme-picker
 * gap from research pain point #9).
 *
 * Accessibility:
 * - role="dialog" + aria-modal="true" + aria-label on the panel
 * - Escape closes
 * - On open, focus is moved to the close button (first interactive element)
 * - Tab/Shift+Tab cycles focus within the panel (simple focus trap)
 * - Backdrop tap closes
 * - Auto-closes when viewport grows to lg+
 */
export function MobileDrawer() {
  const open = useStudioStore((s) => s.mobileDrawerOpen)
  const setOpen = useStudioStore((s) => s.setMobileDrawerOpen)
  const view = useStudioStore((s) => s.mobilePanelView)
  const setView = useStudioStore((s) => s.setMobilePanelView)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Auto-close when resizing up to desktop so the drawer never overlaps the
  // desktop sidebar.
  useEffect(() => {
    if (!open) return
    const mql = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    mql.addEventListener('change', onChange)
    return () => { mql.removeEventListener('change', onChange) }
  }, [open, setOpen])

  return (
    <Overlay
      open={open}
      onClose={() => setOpen(false)}
      aria-label="Navigation and search"
      variant="sheet-left"
      initialFocusRef={closeBtnRef}
      className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lifted lg:hidden"
    >
      <DrawerHeader closeBtnRef={closeBtnRef} onClose={() => setOpen(false)} />
      <TabSwitcher view={view} setView={setView} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'nav' ? (
          <NavTab onNavigate={() => setOpen(false)} />
        ) : (
          <SearchTab onSelect={() => setOpen(false)} />
        )}
      </div>

      <DrawerFooter />
    </Overlay>
  )
}

/* ---------------------------------- Header --------------------------------- */

/** Header of the mobile drawer with brand logo and close button. */
function DrawerHeader({
  closeBtnRef,
  onClose,
}: {
  closeBtnRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 pb-4 pt-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <span className="font-serif text-lg font-semibold leading-none">D</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-serif text-[15px] font-semibold leading-tight tracking-tight">
          Knowledge Studio
        </span>
        <span className="text-caption uppercase tracking-[0.14em] text-ink-faint">
          Local-first · v0.2
        </span>
      </div>
      <button
        ref={closeBtnRef}
        onClick={onClose}
        aria-label="Close drawer"
        className="-mr-1 flex-shrink-0 rounded-md p-2 text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ------------------------------- Tab switcher ------------------------------ */

/** Tab switcher for toggling between navigation and search modes. */
function TabSwitcher({
  view,
  setView,
}: {
  view: 'nav' | 'search'
  setView: (v: 'nav' | 'search') => void
}) {
  return (
    <div className="px-3 pt-3">
      <div
        role="tablist"
        aria-label="Drawer view"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        <button
          role="tab"
          aria-selected={view === 'nav'}
          onClick={() => { setView('nav') }}
          className={cn(
            'rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors focus-ring',
            view === 'nav'
              ? 'bg-saffron text-white shadow-sm'
              : 'text-ink-mute hover:text-ink',
          )}
        >
          Navigate
        </button>
        <button
          role="tab"
          aria-selected={view === 'search'}
          onClick={() => { setView('search') }}
          className={cn(
            'rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors focus-ring',
            view === 'search'
              ? 'bg-saffron text-white shadow-sm'
              : 'text-ink-mute hover:text-ink',
          )}
        >
          Search
        </button>
      </div>
    </div>
  )
}

/* --------------------------------- Nav tab --------------------------------- */

/** Navigation tab listing all sidebar nav groups with active state. */
function NavTab({ onNavigate }: { onNavigate: () => void }) {
  const currentView = useStudioStore((s) => s.currentView)
  const setView = useStudioStore((s) => s.setView)

  const handleSelect = (id: (typeof NAV_GROUPS)[number]['items'][number]['id']) => {
    setView(id)
    onNavigate()
  }

  return (
    <nav className="px-3 pb-3 pt-3" aria-label="Main navigation">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-3.5">
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
                    onClick={() => { handleSelect(item.id) }}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] font-medium transition-all focus-ring',
                      active
                        ? 'bg-saffron-soft text-saffron-deep'
                        : 'text-ink-soft hover:bg-sidebar-accent hover:text-ink',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        active
                          ? 'text-saffron'
                          : 'text-ink-faint group-hover:text-ink-soft',
                      )}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.experimental && (
                      <span className="rounded-full border border-dashed border-saffron/40 px-1.5 py-0 text-badge font-semibold uppercase tracking-wide text-saffron-deep">
                        Lab
                      </span>
                    )}
                    {item.shortcut && (
                      <kbd className="font-mono text-caption text-ink-faint">
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
  )
}

/* ------------------------------- Search tab -------------------------------- */

/** Search tab with keyword/ranked toggle and entity results list. */
function SearchTab({ onSelect }: { onSelect: () => void }) {
  const searchQuery = useStudioStore((s) => s.searchQuery)
  const setSearchQuery = useStudioStore((s) => s.setSearchQuery)
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const startEdit = useStudioStore((s) => s.startEdit)
  const filtered = useFilteredEntities()
  const [mode, setMode] = useState<'keyword' | 'ranked'>('keyword')

  const rankedResults = mode === 'ranked' && searchQuery.trim()
    ? search(entities, claims, searchQuery, 20)
    : []

  const displayEntities = mode === 'ranked' && searchQuery.trim()
    ? rankedResults
        .map((r) => entities.find((e) => e.id === (r.entityId ?? r.id)))
        .filter((e): e is Entity => e !== undefined)
        .slice(0, 20)
    : filtered

  // Empty-state copy follows the desktop SearchPanel exactly
  const emptyCopy = searchQuery ? 'No matches found.' : 'Your library is empty.'

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-3 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge base…"
            aria-label="Search knowledge base"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
          />
        </div>
        <div className="mt-2 flex items-center gap-1 rounded-md bg-muted p-0.5 text-label">
          <button
            onClick={() => { setMode('keyword') }}
            aria-pressed={mode === 'keyword'}
            className={cn(
              'flex-1 rounded px-2 py-1 font-medium transition-colors focus-ring',
              mode === 'keyword'
                ? 'bg-background text-ink shadow-sm'
                : 'text-ink-mute',
            )}
          >
            Keyword
          </button>
          <button
            onClick={() => { setMode('ranked') }}
            aria-pressed={mode === 'ranked'}
            className={cn(
              'flex-1 rounded px-2 py-1 font-medium transition-colors focus-ring',
              mode === 'ranked'
                ? 'bg-background text-ink shadow-sm'
                : 'text-ink-mute',
            )}
          >
            Ranked
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {displayEntities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-ink-faint/50" />
            <p className="text-[12px] text-ink-mute">{emptyCopy}</p>
          </div>
        ) : (
          <ul className="space-y-1.5" role="list" aria-label="Search results">
            {displayEntities.map((e) => {
              const meta = ENTITY_TYPE_META[e.type]
              return (
                <li key={e.id}>
                  <button
                    onClick={() => {
                      startEdit(e.id)
                      onSelect()
                    }}
                    className="group block w-full rounded-md border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-ring"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                      <span className="rounded px-1.5 py-0 text-badge font-semibold uppercase tracking-wide text-ink-faint">
                        {meta.label}
                      </span>
                    </div>
                    <div className="truncate text-[13px] font-medium text-ink">
                      {e.name}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-label leading-snug text-ink-mute">
                      {e.description}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-sidebar-border px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-label font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Offline ready
          </div>
          <span className="text-label text-ink-faint">
            {entities.length} entities
          </span>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- Footer ---------------------------------- */

/** Footer of the mobile drawer with theme toggle and entity count. */
function DrawerFooter() {
  const { theme, setTheme } = useTheme()
  const entities = useStudioStore((s) => s.entities)
  // The drawer is only opened via a client tap, so by the time it mounts the
  // theme has already hydrated — no need for a `mounted` gate. The label
  // simply defaults to "Dark" (the Light action) while `theme` is undefined
  // on the very first paint, which never reaches the user here.
  const isDark = theme === 'dark'
  const toggle = () => setTheme(isDark ? 'light' : 'dark')

  return (
    <div className="border-t border-sidebar-border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring"
        >
          {isDark ? (
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
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-2.5 text-label text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Local search · {entities.length} entities
      </div>
    </div>
  )
}
