import {
  Home, FileText, Library, GitBranch, BrainCircuit, MessageSquare,
  FlaskConical, Grid3X3, Download, Wifi, CalendarDays,
} from 'lucide-react'
import type { ViewId } from '@/lib/studio/types'
import { translate as navT } from '@/lib/i18n/messages/nav'
import { translate as timelineT } from '@/lib/i18n/messages/timeline'

export interface NavItem {
  id: ViewId
  label: string
  icon: typeof Home
  shortcut?: string
  experimental?: boolean
}

/** Shared navigation data used by desktop and mobile navigation. */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: navT('nav.group.overview'), items: [
    { id: 'home', label: navT('nav.home.label'), icon: Home, shortcut: 'G H' },
    { id: 'timeline', label: timelineT('timeline.nav.label'), icon: CalendarDays },
  ] },
  { label: navT('nav.group.capture'), items: [{ id: 'editor', label: navT('nav.editor.label'), icon: FileText, shortcut: 'G E' }] },
  { label: navT('nav.group.explore'), items: [
    { id: 'library', label: navT('nav.library.label'), icon: Library, shortcut: 'G L' },
    { id: 'graph', label: navT('nav.graph.label'), icon: GitBranch, shortcut: 'G G' },
    { id: 'mindmap', label: navT('nav.mindmap.label'), icon: BrainCircuit, shortcut: 'G M' },
  ] },
  { label: navT('nav.group.ask'), items: [{ id: 'chat', label: navT('nav.chat.label'), icon: MessageSquare, shortcut: 'G C' }] },
  { label: navT('nav.group.lab'), items: [
    { id: 'ai', label: navT('nav.ai.label'), icon: FlaskConical, shortcut: 'G A', experimental: true },
    { id: 'triz', label: navT('nav.triz.label'), icon: Grid3X3, shortcut: 'G T', experimental: true },
  ] },
  { label: navT('nav.group.data'), items: [
    { id: 'sync', label: navT('nav.sync.label'), icon: Wifi, shortcut: 'G S' },
    { id: 'export', label: navT('nav.export.label'), icon: Download, shortcut: 'G X' },
  ] },
]
