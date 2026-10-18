'use client'

import { useCallback } from 'react'
import {
  Sun,
  Moon,
  Monitor,
  Search,
  PanelRight,
  PanelRightClose,
} from 'lucide-react'
import { useHydrationSafeTheme } from './theme-provider'
import { RELEASES_BASE_URL } from '@/lib/studio/constants'
import { useIsMacPlatform, formatShortcut } from '@/lib/studio/use-platform-shortcut'
import { useStudioStore } from '@/lib/studio/store'
import type { ViewId } from '@/lib/studio/types'
import packageJson from '../../../package.json'
import { cn } from '@/lib/utils'
import { translate as announceT } from '@/lib/i18n/messages/announce'
import { translate as themeT } from '@/lib/i18n/messages/theme'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { NavGroupList } from './nav-group-list'
import { NAV_GROUPS, type NavItem } from './nav-groups'
export { NAV_GROUPS } from './nav-groups'
import { ShortcutsTrigger } from './shortcuts-dialog'



interface SidebarItemBadgeProps {
  experimental?: boolean
  shortcut?: string
}

const SidebarItemBadge = ({ experimental, shortcut }: SidebarItemBadgeProps) => {
  if (experimental) {
    return (
      <span className="rounded-full border border-dashed border-saffron/40 px-1.5 py-0 text-badge font-semibold uppercase tracking-wide text-saffron-deep">
        Lab
      </span>
    )
  }
  if (shortcut) {
    return (
      <kbd className="hidden font-mono text-badge text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 lg:inline">
        {shortcut}
      </kbd>
    )
  }
  return null
}

interface SidebarNavItemProps {
  item: NavItem
  active: boolean
  onSelect: (id: ViewId) => void
}

const SidebarNavItem = ({ item, active, onSelect }: SidebarNavItemProps) => {
  const Icon = item.icon
  const buttonStateClass = active
    ? 'bg-saffron-soft text-saffron-deep'
    : 'text-ink-soft hover:bg-sidebar-accent hover:text-ink'
  const iconStateClass = active
    ? 'text-saffron'
    : 'text-ink-faint group-hover:text-ink-soft'

  return (
    <li>
      <button
        onClick={() => { onSelect(item.id) }}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-md px-2.5 min-h-touch text-body-sm font-medium transition-all press-scale focus-ring',
          buttonStateClass,
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0 transition-colors', iconStateClass)} />
        <span className="flex-1 text-left">{item.label}</span>
        <SidebarItemBadge experimental={item.experimental} shortcut={item.shortcut} />
      </button>
    </li>
  )
}

/** Sidebar navigation groups with active-state highlighting. */
const SidebarNav = () => {
  const currentView = useStudioStore((s) => s.currentView)
  const setView = useStudioStore((s) => s.setView)
  const announce = useAnnouncer()
  // The view change is visual-only: without a live announcement a screen
  // reader user gets no signal that navigation actually happened.
  const handleSelect = useCallback(
    (id: ViewId) => {
      setView(id)
      if (id === currentView) return
      const item = NAV_GROUPS.flatMap((group) => group.items).find((nav) => nav.id === id)
      announce(announceT('announce.viewSwitched', item?.label ?? id))
    },
    [announce, currentView, setView],
  )

  return (
    <nav aria-label="Main navigation">
      <NavGroupList
        groups={NAV_GROUPS}
        className="flex-1 overflow-y-auto px-3 pb-2"
        groupClassName="mb-4"
      >
        {(item) => (
          <SidebarNavItem
            key={item.id}
            item={item}
            active={currentView === item.id}
            onSelect={handleSelect}
          />
        )}
      </NavGroupList>
    </nav>
  )
}

/** Sidebar with brand, search trigger, navigation, and footer controls. */
export const Sidebar = () => {
  const isMacPlatform = useIsMacPlatform()
  const setCommandOpen = useStudioStore((s) => s.setCommandOpen)
  const rightPanelOpen = useStudioStore((s) => s.rightPanelOpen)
  const setRightPanelOpen = useStudioStore((s) => s.setRightPanelOpen)
  // Hydration-safe: the stored choice arrives after mount, so the first client
  // render matches the server's `system` default (see the hook's docs).
  const { theme, setTheme } = useHydrationSafeTheme()

  const currentTheme = theme ?? 'system'

  const handleThemeToggle = () => {
    if (currentTheme === 'light') {
      setTheme('dark')
    } else if (currentTheme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getThemeMeta = () => {
    if (currentTheme === 'light') {
      return {
        icon: Sun,
        label: themeT('theme.light'),
        ariaLabel: themeT('theme.switchToDark'),
      }
    }
    if (currentTheme === 'dark') {
      return {
        icon: Moon,
        label: themeT('theme.dark'),
        ariaLabel: themeT('theme.switchToSystem'),
      }
    }
    return {
      icon: Monitor,
      label: themeT('theme.system'),
      ariaLabel: themeT('theme.switchToLight'),
    }
  }

  const { icon: ThemeIcon, label: themeLabel, ariaLabel: themeAriaLabel } = getThemeMeta()

  return (
    <aside className="hidden h-full w-[248px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground lg:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <img src="/logo.svg" alt="" className="h-9 w-9" />
        <div className="flex flex-col">
          <span className="font-serif text-body-lg font-semibold leading-tight tracking-tight">
            Knowledge Studio
          </span>
          <a
            href={`${RELEASES_BASE_URL}/tag/v${packageJson.version}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Knowledge Studio v${packageJson.version} release page`}
            className="inline-flex min-h-touch items-center text-caption uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-saffron focus-ring"
          >
            Local-first · v{packageJson.version}
          </a>
        </div>
      </div>

      {/* Search trigger */}
      <div className="px-3 pb-3">
        <button
          onClick={() => { setCommandOpen(true) }}
          className="group flex w-full items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-left text-body-sm text-ink-mute transition-colors hover:border-saffron/40 hover:text-ink-soft focus-ring min-h-touch"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search…</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-caption text-ink-faint">
            {formatShortcut('⌘K', isMacPlatform)}
          </kbd>
        </button>
      </div>

      {/* Nav groups */}
      <SidebarNav />

      {/* Footer */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-2.5">
        <button
          onClick={handleThemeToggle}
          className="flex items-center gap-2 rounded-md px-2.5 min-h-touch text-label-lg font-medium text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring"
          // WCAG 2.5.3 (Label in Name, Level A): the accessible name must
          // contain the visible label, or voice control cannot target the
          // button by the text it shows. The action alone ("Switch to dark
          // theme") never contains the visible state label ("Light"), so the
          // two are composed here.
          aria-label={`${themeLabel} — ${themeAriaLabel}`}
        >
          <ThemeIcon className="h-4 w-4" />
          <span>{themeLabel}</span>
        </button>
        <ShortcutsTrigger
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 min-h-touch text-label-lg font-medium text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring',
          )}
        />
        <div className="flex-1" />
        <button
          onClick={() => { setRightPanelOpen(!rightPanelOpen) }}
          className="rounded-md p-1.5 min-h-touch min-w-touch flex items-center justify-center text-ink-mute transition-colors hover:bg-sidebar-accent hover:text-ink focus-ring"
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
