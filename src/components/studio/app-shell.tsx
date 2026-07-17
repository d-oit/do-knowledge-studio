'use client'

import { useStudioStore } from '@/lib/studio/store'
import React, { Suspense, lazy } from 'react'
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
import { ViewErrorBoundary } from './view-error-boundary'
import { Skeleton } from './ui/skeleton'

const GraphView = lazy(() => import('./views/graph-view').then((m) => ({ default: m.GraphView })))
const MindMapView = lazy(() => import('./views/mindmap-view').then((m) => ({ default: m.MindMapView })))
const AIHarnessView = lazy(() => import('./views/ai-harness-view').then((m) => ({ default: m.AIHarnessView })))
const TrizView = lazy(() => import('./views/triz-view').then((m) => ({ default: m.TrizView })))
const ExportView = lazy(() => import('./views/export-view').then((m) => ({ default: m.ExportView })))
const SyncView = lazy(() => import('./views/sync-view').then((m) => ({ default: m.SyncView })))

function ViewLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}

const VIEW_NAMES: Record<string, string> = {
  home: 'Home',
  editor: 'Editor',
  library: 'Library',
  graph: 'Graph',
  mindmap: 'Mind Map',
  chat: 'Chat',
  ai: 'AI Harness',
  triz: 'TRIZ Matrix',
  export: 'Export',
  sync: 'Sync',
}

export function AppShell() {
  const currentView = useStudioStore((s) => s.currentView)
  const editingEntityId = useStudioStore((s) => s.editingEntityId)

  const handleViewError = React.useCallback(
    (error: Error, _errorInfo: React.ErrorInfo) => {
      console.error(`[ViewError] ${currentView}:`, error)
    },
    [currentView],
  )

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <ErrorBoundary key={currentView}>
              <ViewErrorBoundary
                viewName={VIEW_NAMES[currentView] ?? currentView}
                onError={handleViewError}
              >
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
              </ViewErrorBoundary>
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
