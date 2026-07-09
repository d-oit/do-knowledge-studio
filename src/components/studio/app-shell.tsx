'use client'

import { useStudioStore } from '@/lib/studio/store'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from './command-palette'
import { RightPanel } from './right-panel'
import { MobileDrawer } from './mobile-drawer'
import { ShortcutsDialog } from './shortcuts-dialog'
import { HomeView } from './views/home-view'
import { EditorView } from './views/editor-view'
import { LibraryView } from './views/library-view'
import { GraphView } from './views/graph-view'
import { MindMapView } from './views/mindmap-view'
import { ChatView } from './views/chat-view'
import { AIHarnessView } from './views/ai-harness-view'
import { TrizView } from './views/triz-view'
import { ExportView } from './views/export-view'
import { ErrorBoundary } from './error-boundary'

export function AppShell() {
  const { currentView, editingEntityId } = useStudioStore()

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <ErrorBoundary key={currentView}>
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
