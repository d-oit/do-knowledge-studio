import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const { mockStopViewHashSync } = vi.hoisted(() => ({
  mockStopViewHashSync: vi.fn(),
}))

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

vi.mock('./views/timeline-view', () => ({
  TimelineView: () => <div data-testid="timeline-view">Timeline</div>,
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
  ErrorBoundary: ({ children }: { children?: ReactNode }) => children,
}))

vi.mock('./view-error-boundary', () => ({
  ViewErrorBoundary: ({ children }: { children?: ReactNode; viewName?: string }) => children,
}))

vi.mock('./ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}))

vi.mock('@/lib/sync/bridge', () => ({
  startBidirectionalSync: vi.fn(() => vi.fn()),
}))

vi.mock('@/lib/studio/view-hash-sync', () => ({
  startViewHashSync: vi.fn(() => mockStopViewHashSync),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

let currentView = 'home'
let editingEntityId: string | null = null

const mockStartEdit = vi.fn()
/** Hydration refusal status the mocked guard reports; reset per test. */
let mockRefusal: { reason: string; raw: string | null; preserved: boolean } | null = null
const refusalListeners = new Set<() => void>()
const finishHydrationListeners = new Set<() => void>()

vi.mock('@/lib/studio/hydration-guard', () => ({
  getHydrationRefusal: () => mockRefusal,
  subscribeToHydrationRefusal: (listener: () => void) => {
    refusalListeners.add(listener)
    return () => {
      refusalListeners.delete(listener)
    }
  },
}))

vi.mock('@/lib/studio/hydration-quarantine', () => ({
  readQuarantine: () => null,
}))

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ currentView, editingEntityId, startEdit: mockStartEdit }),
    {
      getState: () => ({ startEdit: mockStartEdit }),
      persist: {
        onFinishHydration: (listener: () => void) => {
          finishHydrationListeners.add(listener)
          return () => {
            finishHydrationListeners.delete(listener)
          }
        },
      },
    },
  ),
}))

import { AppShell } from './app-shell'
import { startBidirectionalSync } from '@/lib/sync/bridge'
import { startViewHashSync } from '@/lib/studio/view-hash-sync'

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentView = 'home'
    editingEntityId = null
    mockRefusal = null
    refusalListeners.clear()
    finishHydrationListeners.clear()
  })

  it('renders the Sidebar', () => {
    render(<AppShell />)
    expect(screen.getByTestId('sidebar')).toBeDefined()
  })

  it('marks the shell ready after mount for the app-ready E2E wait', () => {
    const { container } = render(<AppShell />)
    // The E2E helper `waitForAppReady` waits on this attribute; React flushes
    // child effects first, so its presence means descendant listeners are bound.
    expect(container.querySelector('[data-app-ready="true"]')).not.toBeNull()
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
    expect(screen.getByText(/Knowledge Studio — local-first knowledge engine/u)).toBeDefined()
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

  it('renders TimelineView when currentView is timeline', () => {
    currentView = 'timeline'
    render(<AppShell />)
    expect(screen.getByTestId('timeline-view')).toBeDefined()
  })

  it('renders ChatView when currentView is chat', async () => {
    currentView = 'chat'
    render(<AppShell />)
    expect(await screen.findByText('Chat')).toBeDefined()
  })

  it('renders ExportView when currentView is export', async () => {
    currentView = 'export'
    render(<AppShell />)
    expect(await screen.findByTestId('export-view')).toBeDefined()
  })

  it('renders SyncView when currentView is sync', async () => {
    currentView = 'sync'
    render(<AppShell />)
    expect(await screen.findByTestId('sync-view')).toBeDefined()
  })

  it('renders GraphView when currentView is graph', async () => {
    currentView = 'graph'
    render(<AppShell />)
    expect(await screen.findByTestId('graph-view')).toBeDefined()
  })

  it('renders MindMapView when currentView is mindmap', async () => {
    currentView = 'mindmap'
    render(<AppShell />)
    expect(await screen.findByTestId('mindmap-view')).toBeDefined()
  })

  it('renders AIHarnessView when currentView is ai', async () => {
    currentView = 'ai'
    render(<AppShell />)
    expect(await screen.findByTestId('ai-harness-view')).toBeDefined()
  })

  it('renders TrizView when currentView is triz', async () => {
    currentView = 'triz'
    render(<AppShell />)
    expect(await screen.findByTestId('triz-view')).toBeDefined()
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

  it('shows the recovery alert on Home, not just in Export', () => {
    // The banner used to be mounted only in the lazy Export view, so a user
    // whose library failed to hydrate saw an ordinary demo Home screen.
    currentView = 'home'
    mockRefusal = { reason: 'no safe migration from version 99', raw: null, preserved: false }

    render(<AppShell />)

    expect(screen.getByTestId('quarantine-unpreserved-banner')).toBeDefined()
  })

  it('replaces SyncView with an unavailable notice while a refusal is live', () => {
    currentView = 'sync'
    mockRefusal = { reason: 'no safe migration from version 99', raw: null, preserved: false }

    render(<AppShell />)

    // SyncView can join a room and resolve conflicts against a store that
    // never held the user's corpus.
    expect(screen.getByTestId('sync-unavailable')).toBeDefined()
    expect(screen.queryByTestId('sync-view')).toBeNull()
  })

  it('does not start sync services while a refusal is live', () => {
    mockRefusal = { reason: 'no safe migration from version 99', raw: null, preserved: false }

    render(<AppShell />)

    expect(startBidirectionalSync).not.toHaveBeenCalled()
    expect(startViewHashSync).not.toHaveBeenCalled()
  })

  it('starts sync services on a normal hydration', async () => {
    render(<AppShell />)

    await waitFor(() => {
      expect(startBidirectionalSync).toHaveBeenCalled()
      expect(startViewHashSync).toHaveBeenCalled()
    })
  })

  it('reacts when a refusal arrives after mount', async () => {
    render(<AppShell />)
    await waitFor(() => { expect(startBidirectionalSync).toHaveBeenCalled() })
    const stopBridge = vi.mocked(startBidirectionalSync).mock.results[0]?.value
    expect(screen.queryByTestId('quarantine-unpreserved-banner')).toBeNull()

    await act(async () => {
      mockRefusal = { reason: 'storage unreadable', raw: null, preserved: false }
      for (const listener of refusalListeners) listener()
    })

    // A late refusal must not leave either sync service active, and the
    // warning must appear without a reload.
    expect(screen.getByTestId('quarantine-unpreserved-banner')).toBeDefined()
    expect(stopBridge).toHaveBeenCalled()
    expect(mockStopViewHashSync).toHaveBeenCalled()
  })
})
