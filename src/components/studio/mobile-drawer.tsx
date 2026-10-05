'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import { X, Sun, Moon } from 'lucide-react'
import packageJson from '../../../package.json'
import { useTheme } from 'next-themes'
import { RELEASES_BASE_URL } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'
import { NAV_GROUPS } from './sidebar'
import { cn } from '@/lib/utils'
import { translate } from '@/lib/i18n/messages/mobile-drawer'
import { EntitySearchPanel } from './entity-search-panel'


/* ---------------------------------- Header --------------------------------- */

/** Header of the mobile drawer with brand logo and close button. */
const DrawerHeader = ({
  closeBtnRef,
  onClose,
}: {
  closeBtnRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) => {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 pb-4 pt-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <span className="font-serif text-lg font-semibold leading-none">D</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-serif text-[15px] font-semibold leading-tight tracking-tight">
          {translate('drawer.brand')}
        </span>
        <a
          href={`${RELEASES_BASE_URL}/tag/v${packageJson.version}`}
          target="_blank"
          rel="noreferrer"
          aria-label={translate('drawer.releaseAriaLabel', packageJson.version)}
          className="inline-flex min-h-[44px] items-center text-caption uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-saffron focus-ring"
        >
          {translate('drawer.releaseBadge', packageJson.version)}
        </a>
      </div>
      <button
        ref={closeBtnRef}
        onClick={onClose}
        aria-label={translate('drawer.close')}
        className="-mr-1 flex-shrink-0 rounded-md p-2 text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ------------------------------- Tab switcher ------------------------------ */

/** Tab switcher for toggling between navigation and search modes. */
const TabSwitcher = ({
  view,
  setView,
}: {
  view: 'nav' | 'search'
  setView: (v: 'nav' | 'search') => void
}) => {
  return (
    <div className="px-3 pt-3">
      <div
        role="tablist"
        aria-label={translate('drawer.tabsAriaLabel')}
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        <button
          role="tab"
          aria-selected={view === 'nav'}
          onClick={() => { setView('nav') }}
          className={cn(
            'rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors focus-ring',
            view === 'nav'
              ? 'bg-saffron text-saffron-foreground shadow-sm'
              : 'text-ink-mute hover:text-ink',
          )}
        >
          {translate('drawer.tab.navigate')}
        </button>
        <button
          role="tab"
          aria-selected={view === 'search'}
          onClick={() => { setView('search') }}
          className={cn(
            'rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors focus-ring',
            view === 'search'
              ? 'bg-saffron text-saffron-foreground shadow-sm'
              : 'text-ink-mute hover:text-ink',
          )}
        >
          {translate('drawer.tab.search')}
        </button>
      </div>
    </div>
  )
}

/* --------------------------------- Nav tab --------------------------------- */

/** Navigation tab listing all sidebar nav groups with active state. */
const NavTab = ({ onNavigate }: { onNavigate: () => void }) => {
  const currentView = useStudioStore((s) => s.currentView)
  const setView = useStudioStore((s) => s.setView)

  const handleSelect = (id: (typeof NAV_GROUPS)[number]['items'][number]['id']) => {
    setView(id)
    onNavigate()
  }

  return (
    <nav className="px-3 pb-3 pt-3" aria-label={translate('drawer.navAriaLabel')}>
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
                        {translate('drawer.lab')}
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

/** Search tab wrapping the shared EntitySearchPanel. */
const SearchTab = ({ onSelect }: { onSelect: () => void }) => {
  return <EntitySearchPanel density="drawer" onSelect={onSelect} />
}

/* --------------------------------- Footer ---------------------------------- */

/** Footer of the mobile drawer with theme toggle and entity count. */
const DrawerFooter = () => {
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
          aria-label={isDark ? translate('drawer.theme.lightAria') : translate('drawer.theme.darkAria')}
          className="flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring"
        >
          {isDark ? (
            <>
              <Sun className="h-4 w-4" />
              <span>{translate('drawer.theme.light')}</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              <span>{translate('drawer.theme.dark')}</span>
            </>
          )}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-2.5 text-label text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {translate('drawer.footer.localSearch', String(entities.length))}
      </div>
    </div>
  )
}


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
export const MobileDrawer = () => {
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
      aria-label={translate('drawer.ariaLabel')}
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