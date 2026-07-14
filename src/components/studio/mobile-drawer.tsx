'use client'

import { useEffect, useRef, useState, useCallback, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Search, Sun, Moon, FileText } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useStudioStore, useFilteredEntities } from '@/lib/studio/store'
import { ENTITY_TYPE_META } from '@/lib/studio/types'
import { NAV_GROUPS } from './sidebar'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

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
  const reducedMotion = useReducedMotion()

  const panelRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Escape to close — only attached while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  // Auto-close when resizing up to desktop so the drawer never overlaps the
  // desktop sidebar.
  useEffect(() => {
    if (!open) return
    const mql = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [open, setOpen])

  // Focus the close button when the drawer opens (first interactive element)
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 60)
    return () => window.clearTimeout(t)
  }, [open])

  // Simple focus trap — Tab / Shift+Tab cycles within the panel
  const handleTabKey = useCallback(
    (e: KeyboardEvent) => {
      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') handleTabKey(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleTabKey])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — fade in, tap to close */}
          <motion.div
            key="mobile-drawer-backdrop"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[80] bg-ink/40 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Panel — slide in from the left */}
          <motion.div
            key="mobile-drawer-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation and search"
            initial={reducedMotion ? { x: 0 } : { x: '-100%' }}
            animate={{ x: 0 }}
            exit={reducedMotion ? { x: 0, opacity: 0 } : { x: '-100%' }}
            transition={reducedMotion ? { duration: 0 } : { type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-y-0 left-0 z-[90] flex h-dvh w-[min(86vw,340px)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lifted lg:hidden"
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ---------------------------------- Header --------------------------------- */

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
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">
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
          onClick={() => setView('nav')}
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
          onClick={() => setView('search')}
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
          <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            {group.label}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const active = currentView === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleSelect(item.id)}
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
                      <span className="rounded-full border border-dashed border-saffron/40 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-saffron">
                        Lab
                      </span>
                    )}
                    {item.shortcut && (
                      <kbd className="font-mono text-[10px] text-ink-faint/70">
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

function SearchTab({ onSelect }: { onSelect: () => void }) {
  const searchQuery = useStudioStore((s) => s.searchQuery)
  const setSearchQuery = useStudioStore((s) => s.setSearchQuery)
  const entities = useStudioStore((s) => s.entities)
  const startEdit = useStudioStore((s) => s.startEdit)
  const filtered = useFilteredEntities()
  const [mode, setMode] = useState<'keyword' | 'semantic'>('keyword')

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
        <div className="mt-2 flex items-center gap-1 rounded-md bg-muted p-0.5 text-[11px]">
          <button
            onClick={() => setMode('keyword')}
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
            onClick={() => setMode('semantic')}
            aria-pressed={mode === 'semantic'}
            className={cn(
              'flex-1 rounded px-2 py-1 font-medium transition-colors focus-ring',
              mode === 'semantic'
                ? 'bg-background text-ink shadow-sm'
                : 'text-ink-mute',
            )}
          >
            Semantic
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-ink-faint/50" />
            <p className="text-[12px] text-ink-mute">{emptyCopy}</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.slice(0, 20).map((e) => {
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
                      <span className="rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-ink-faint">
                        {meta.label}
                      </span>
                    </div>
                    <div className="truncate text-[13px] font-medium text-ink">
                      {e.name}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-mute">
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
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Offline ready
          </div>
          <span className="text-[11px] text-ink-faint">
            {entities.length} entities
          </span>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- Footer ---------------------------------- */

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
      <div className="mt-2 flex items-center gap-1.5 px-2.5 text-[11px] text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Local search · {entities.length} entities
      </div>
    </div>
  )
}
