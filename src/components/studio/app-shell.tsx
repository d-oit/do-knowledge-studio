'use client'

import { useStudioStore } from '@/lib/studio/store'
import { Suspense, lazy } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from './command-palette'
import { RightPanel } from './right-panel'
import { MobileDrawer } from './mobile-drawer'
import { ShortcutsDialog } from './shortcuts-dialog'
import { HomeView } from './views/home-view'
import { EditorView } from './views/editor-view'
import { LibraryView } from './views/library-view'
import { ChatView } from './views/chat-view'
import { ErrorBoundary } from './error-boundary'

const GraphView = lazy(() => import('./views/graph-view').then((m) => ({ default: m.GraphView })))
const MindMapView = lazy(() => import('./views/mindmap-view').then((m) => ({ default: m.MindMapView })))
const AIHarnessView = lazy(() => import('./views/ai-harness-view').then((m) => ({ default: m.AIHarnessView })))
const TrizView = lazy(() => import('./views/triz-view').then((m) => ({ default: m.TrizView })))
const ExportView = lazy(() => import('./views/export-view').then((m) => ({ default: m.ExportView })))
const SyncView = lazy(() => import('./views/sync-view').then((m) => ({ default: m.SyncView })))

function ViewLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-saffron" />
    </div>
  )
}

export function AppShell() {
  const currentView = useStudioStore((s) => s.currentView)
  const editingEntityId = useStudioStore((s) => s.editingEntityId)

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <ErrorBoundary key={currentView}>
              <Suspense fallback={<ViewLoader />}>
                {currentView === 'home' && <HomeView />}
                {currentView === 'editor' && (
                  <EditorView key={editingEntityId || 'new'} />
                )}
                {currentView === 'library' && <LibraryView />}
                {currentView === 'graph' && <GraphView />}
                {currentView === 'mindmap' && <MindMapView />}
                {currentView === 'chat' && <ChatView />}
                {currentView === 'ai' && <AIHarnessView />}
                {currentView === 'triz' && <TrizView />}
                {currentView === 'export' && <ExportView />}
                {currentView === 'sync' && <SyncView />}
              </Suspense>
            </ErrorBoundary>
          </div>
          <RightPanel />
        </main>
      </div>
      <CommandPalette />
      <MobileDrawer />
      <ShortcutsDialog />
    </div>
  )
}
