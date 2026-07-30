import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('./sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}))

vi.mock('./topbar', () => ({
  Topbar: () => <div data-testid="topbar">Topbar</div>,
}))

vi.mock('./command-palette', () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}))

vi.mock('./right-panel', () => ({
  RightPanel: () => <div data-testid="right-panel" />,
}))

vi.mock('./mobile-drawer', () => ({
  MobileDrawer: () => <div data-testid="mobile-drawer" />,
}))

vi.mock('./shortcuts-dialog', () => ({
  ShortcutsDialog: () => <div data-testid="shortcuts-dialog" />,
}))

vi.mock('./views/home-view', () => ({
  HomeView: () => <div data-testid="home-view">Home</div>,
}))

vi.mock('./views/editor-view', () => ({
  EditorView: () => <div data-testid="editor-view">Editor</div>,
}))

vi.mock('./views/library-view', () => ({
  LibraryView: () => <div data-testid="library-view">Library</div>,
}))

vi.mock('./views/chat-view', () => ({
  ChatView: () => <div data-testid="chat-view">Chat</div>,
}))

vi.mock('./views/graph-view', () => ({
  GraphView: () => <div data-testid="graph-view">Graph</div>,
}))

vi.mock('./views/mindmap-view', () => ({
  MindMapView: () => <div data-testid="mindmap-view">MindMap</div>,
}))

vi.mock('./views/ai-harness-view', () => ({
  AIHarnessView: () => <div data-testid="ai-harness-view">AI Harness</div>,
}))

vi.mock('./views/triz-view', () => ({
  TrizView: () => <div data-testid="triz-view">TRIZ</div>,
}))

vi.mock('./views/export-view', () => ({
  ExportView: () => <div data-testid="export-view">Export</div>,
}))

vi.mock('./views/sync-view', () => ({
  SyncView: () => <div data-testid="sync-view">Sync</div>,
}))

vi.mock('./error-boundary', () => ({
  ErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('./view-error-boundary', () => ({
  ViewErrorBoundary: ({ children }: { children?: ReactNode; viewName?: string }) => <>{children}</>,
}))

vi.mock('./ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}))

vi.mock('@/lib/sync/bridge', () => ({
  startBidirectionalSync: vi.fn(() => vi.fn()),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

let currentView = 'home'
let editingEntityId: string | null = null

const mockStartEdit = vi.fn()

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ currentView, editingEntityId, startEdit: mockStartEdit }),
    {
      getState: () => ({ startEdit: mockStartEdit }),
    },
  ),
}))

import { AppShell } from './app-shell'

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentView = 'home'
    editingEntityId = null
  })

  it('renders the Sidebar', () => {
    render(<AppShell />)
    expect(screen.getByTestId('sidebar')).toBeDefined()
  })

  it('renders the Topbar', () => {
    render(<AppShell />)
    expect(screen.getByTestId('topbar')).toBeDefined()
  })

  it('renders the CommandPalette', () => {
    render(<AppShell />)
    expect(screen.getByTestId('command-palette')).toBeDefined()
  })

  it('renders the RightPanel', () => {
    render(<AppShell />)
    expect(screen.getByTestId('right-panel')).toBeDefined()
  })

  it('renders the MobileDrawer', () => {
    render(<AppShell />)
    expect(screen.getByTestId('mobile-drawer')).toBeDefined()
  })

  it('renders the ShortcutsDialog', () => {
    render(<AppShell />)
    expect(screen.getByTestId('shortcuts-dialog')).toBeDefined()
  })

  it('renders the skip to main content link', () => {
    render(<AppShell />)
    expect(screen.getByText('Skip to main content')).toBeDefined()
  })

  it('skip link points to #main-content', () => {
    render(<AppShell />)
    const skipLink = screen.getByText('Skip to main content')
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('renders main content area with id', () => {
    render(<AppShell />)
    expect(document.getElementById('main-content')).toBeDefined()
  })

  it('renders the footer', () => {
    render(<AppShell />)
    expect(screen.getByText(/Knowledge Studio — local-first knowledge engine/)).toBeDefined()
  })

  it('footer has contentinfo role', () => {
    render(<AppShell />)
    expect(screen.getByRole('contentinfo')).toBeDefined()
  })

  it('renders HomeView when currentView is home', () => {
    currentView = 'home'
    render(<AppShell />)
    expect(screen.getByTestId('home-view')).toBeDefined()
  })

  it('renders EditorView when currentView is editor', () => {
    currentView = 'editor'
    render(<AppShell />)
    expect(screen.getByTestId('editor-view')).toBeDefined()
  })

  it('renders LibraryView when currentView is library', () => {
    currentView = 'library'
    render(<AppShell />)
    expect(screen.getByTestId('library-view')).toBeDefined()
  })

  it('renders ChatView when currentView is chat', () => {
    currentView = 'chat'
    render(<AppShell />)
    expect(screen.getByTestId('chat-view')).toBeDefined()
  })

  it('renders ExportView when currentView is export', async () => {
    currentView = 'export'
    await act(async () => { render(<AppShell />) })
    expect(screen.getByTestId('export-view')).toBeDefined()
  })

  it('renders SyncView when currentView is sync', async () => {
    currentView = 'sync'
    await act(async () => { render(<AppShell />) })
    expect(screen.getByTestId('sync-view')).toBeDefined()
  })

  it('renders GraphView when currentView is graph', async () => {
    currentView = 'graph'
    await act(async () => { render(<AppShell />) })
    expect(screen.getByTestId('graph-view')).toBeDefined()
  })

  it('renders MindMapView when currentView is mindmap', async () => {
    currentView = 'mindmap'
    await act(async () => { render(<AppShell />) })
    expect(screen.getByTestId('mindmap-view')).toBeDefined()
  })

  it('renders AIHarnessView when currentView is ai', async () => {
    currentView = 'ai'
    await act(async () => { render(<AppShell />) })
    expect(screen.getByTestId('ai-harness-view')).toBeDefined()
  })

  it('renders TrizView when currentView is triz', async () => {
    currentView = 'triz'
    await act(async () => { render(<AppShell />) })
    expect(screen.getByTestId('triz-view')).toBeDefined()
  })

  it('does not render HomeView when on different view', () => {
    currentView = 'editor'
    render(<AppShell />)
    expect(screen.queryByTestId('home-view')).toBeNull()
  })

  it('layout uses full viewport height', () => {
    const { container } = render(<AppShell />)
    const root = container.firstElementChild!
    expect(root.className).toContain('h-dvh')
  })

  it('layout is a flex row', () => {
    const { container } = render(<AppShell />)
    const root = container.firstElementChild!
    expect(root.className).toContain('flex')
    expect(root.className).toContain('overflow-hidden')
  })
})
