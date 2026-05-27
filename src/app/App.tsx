import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { DbProvider, useDb } from '../db/DbProvider';
import { repository } from '../db/repository';
import { logger } from '../lib/logger';
import { hydrateOramaIndex } from '../lib/search';
import { SearchResult } from '../lib/search';
import { Entity, Link } from '../lib/validation';
import { perf, Profiled, PerfPanel } from '../lib/perf';
import '../styles/index.css';
import SidebarNav from '../components/SidebarNav';
import Header from '../components/Header';
import MobileDrawer from '../components/MobileDrawer';
import ErrorBoundary from '../components/ErrorBoundary';
import ThemeSwitcher from '../components/ThemeSwitcher';
const CommandPalette = lazy(() => import('../components/CommandPalette'));
import { escapeHtml } from '../lib/security';
import {
  EditorSkeleton,
  GraphSkeleton,
  MindMapSkeleton,
  AISkeleton,
  SearchSkeleton,
  ExportSkeleton
} from '../components/Skeletons';

// Preload functions for lazy chunks (triggered on hover/focus)
const preloadEditor = () => import('../features/editor/Editor');
const preloadSearch = () => import('../features/search/SearchPanel');
const preloadGraph = () => import('../features/graph/GraphView');
const preloadGraphControls = () => import('../features/graph/GraphControls');
const preloadMindMap = () => import('../features/mindmap/MindMapView');
const preloadChat = () => import('../features/chat/Chat');
const preloadExport = () => import('../features/export/ExportPanel');
const preloadAI = () => import('../features/ai/AIHarness');

// Lazy-loaded features
const Editor = lazy(preloadEditor);
const SearchPanel = lazy(preloadSearch);
const GraphControls = lazy(preloadGraphControls);
const GraphView = lazy(preloadGraph);
const MindMapView = lazy(preloadMindMap);
const Chat = lazy(preloadChat);
const ExportPanel = lazy(preloadExport);
const AIHarness = lazy(preloadAI);

type View = 'editor' | 'graph' | 'mindmap' | 'chat' | 'export' | 'ai' | 'library';

const AppContent: React.FC = () => {
  const { dbReady, error } = useDb();
  const [currentView, setCurrentView] = useState<View>('editor');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isPerfOpen, setIsPerfOpen] = useState(false);

  // Shared state for GraphView mobile controls
  const [graphFocusMode, setGraphFocusMode] = useState(false);
  const [graphSelectedNode, setGraphSelectedNode] = useState<string | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);

  const handlePreload = useCallback((view: string) => {
    switch (view) {
      case 'graph': void preloadGraph(); break;
      case 'mindmap': void preloadMindMap(); break;
      case 'chat': void preloadChat(); break;
      case 'export': void preloadExport(); break;
      case 'ai': void preloadAI(); break;
      case 'search': void preloadSearch(); break;
      case 'library': void preloadEditor(); break;
    }
  }, []);

  const handleEditEntity = useCallback((entityId: string) => {
    setEditingEntityId(entityId);
    setCurrentView('editor');
  }, []);

  const refreshData = useCallback(async () => {
    if (!dbReady) return;
    try {
      const e = await repository.getAllEntities();
      const l = await repository.getAllLinks();
      setEntities(e);
      setLinks(l);
    } catch (err) {
      logger.error('Data refresh failed', err);
    }
  }, [dbReady]);

  const handleEditComplete = useCallback(() => {
    setEditingEntityId(null);
    void refreshData();
  }, [refreshData]);

  const handleSearchResultClick = useCallback((result: SearchResult) => {
    if (result.type === 'claim' || result.type === 'entity' || result.type === 'note' || result.type === 'concept' || result.type === 'person' || result.type === 'project') {
       setCurrentView('editor');
    }
    setIsSearchOpen(false);
  }, []);

  // Deferred startup: non-critical tasks pushed to idle callback
  useEffect(() => {
    if (!dbReady) return;

    const performDeferredStartup = () => {
      logger.info('Knowledge Studio ready');
      perf.mark('app-db-ready');
      perf.measure('app-boot-time', 'app-bootstrap-start', 'app-db-ready');

      hydrateOramaIndex();

      // refreshData loads all entities/links — deferred for the default 'editor' view
      // Graph/mind map views trigger their own refresh via the view-change effect below
      const scheduleRefresh = (window as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
        ?? ((cb: () => void) => setTimeout(cb, 200));
      scheduleRefresh(() => { refreshData().catch((err: unknown) => logger.error('Deferred refreshData failed', err)); });
    };

    const ric = (window as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) {
      ric(() => performDeferredStartup(), { timeout: 1000 });
    } else {
      setTimeout(performDeferredStartup, 200);
    }
  }, [dbReady, refreshData]);

  useEffect(() => {
    if (dbReady && (currentView === 'graph' || currentView === 'mindmap')) {
      void refreshData();
    }
  }, [currentView, dbReady, refreshData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setIsPerfOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (error) return <div className="error-screen">{typeof error === 'string' ? escapeHtml(error) : String(error)}</div>;

  return (
    <div className="layout-container">
      <Header
        onMenuClick={() => setIsMenuOpen(true)}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      <div className="layout-body">
          <aside className="desktop-sidebar">
            <SidebarNav currentView={currentView} setCurrentView={setCurrentView} onSearchClick={() => setIsPaletteOpen(true)} onPreload={handlePreload} />
          <div className="sidebar-theme-section">
            <ThemeSwitcher />
          </div>
        </aside>

        <main className="main-content">
          {!dbReady && <div className="loading-screen">Booting Knowledge Studio...</div>}
          {(dbReady && currentView === 'editor') || currentView === 'library' ? (
            <Suspense fallback={<EditorSkeleton />}>
              <ErrorBoundary featureName="Editor" onRetry={() => window.location.reload()}>
                <Profiled id="Editor">
                  <Editor
                    editingEntityId={editingEntityId}
                    onEditComplete={handleEditComplete}
                  />
                </Profiled>
              </ErrorBoundary>
            </Suspense>
          ) : null}
          {dbReady && currentView === 'graph' && (
            <Suspense fallback={<GraphSkeleton />}>
              <ErrorBoundary featureName="Graph View" onRetry={() => window.location.reload()}>
                <Profiled id="GraphView">
                  <GraphView
                    entities={entities}
                    links={links}
                    focusMode={graphFocusMode}
                    onFocusModeChange={setGraphFocusMode}
                    selectedNode={graphSelectedNode}
                    onSelectedNodeChange={setGraphSelectedNode}
                    hideToolbar={window.innerWidth < 768}
                    onEditEntity={handleEditEntity}
                  />
                </Profiled>
              </ErrorBoundary>
            </Suspense>
          )}
          {dbReady && currentView === 'mindmap' && entities.length > 0 && (
            <Suspense fallback={<MindMapSkeleton />}>
              <ErrorBoundary featureName="Mind Map" onRetry={() => window.location.reload()}>
                <Profiled id="MindMapView">
                  <MindMapView
                    rootEntity={entities[0]}
                    relatedEntities={entities.slice(1, 10)}
                    entities={entities}
                    links={links}
                  />
                </Profiled>
              </ErrorBoundary>
            </Suspense>
          )}
          {dbReady && currentView === 'mindmap' && entities.length === 0 && (
             <div className="empty-state">No entities found. Create some in the Editor first.</div>
          )}
          {dbReady && currentView === 'chat' && (
            <Suspense fallback={<AISkeleton />}>
              <ErrorBoundary featureName="Chat" onRetry={() => window.location.reload()}>
                <Chat />
              </ErrorBoundary>
            </Suspense>
          )}
          {dbReady && currentView === 'export' && (
            <Suspense fallback={<ExportSkeleton />}>
              <ErrorBoundary featureName="Export" onRetry={() => window.location.reload()}>
                <ExportPanel />
              </ErrorBoundary>
            </Suspense>
          )}
          {dbReady && currentView === 'ai' && (
            <Suspense fallback={<AISkeleton />}>
              <ErrorBoundary featureName="AI" onRetry={() => window.location.reload()}>
                <AIHarness />
              </ErrorBoundary>
            </Suspense>
          )}
        </main>

        <aside className="search-sidebar">
          <Suspense fallback={<SearchSkeleton />}>
            <SearchPanel onResultClick={handleSearchResultClick} />
          </Suspense>
        </aside>
      </div>

      <Suspense fallback={null}>
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          onViewChange={setCurrentView}
        />
      </Suspense>

      <MobileDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)}>
        <SidebarNav
          currentView={currentView}
          setCurrentView={setCurrentView}
          onClose={() => setIsMenuOpen(false)}
          onPreload={handlePreload}
        />
        <div className="drawer-theme-section">
          <ThemeSwitcher compact />
        </div>
        {currentView === 'graph' && (
          <div className="drawer-extra-controls">
            <h3>Graph Controls</h3>
            <Suspense fallback={<div>Loading controls...</div>}>
              <GraphControls
                focusMode={graphFocusMode}
                setFocusMode={setGraphFocusMode}
                hasSelection={!!graphSelectedNode}
                selectedName={entities.find(e => e.id === graphSelectedNode)?.name}
              />
            </Suspense>
          </div>
        )}
      </MobileDrawer>

      {isSearchOpen && (
        <div className="mobile-search-overlay">
          <Suspense fallback={<SearchSkeleton />}>
            <SearchPanel
              isMobile
              onClose={() => setIsSearchOpen(false)}
              onResultClick={handleSearchResultClick}
            />
          </Suspense>
        </div>
      )}

      <PerfPanel isOpen={isPerfOpen} onClose={() => setIsPerfOpen(false)} />
    </div>
  );
};

const App: React.FC = () => (
  <DbProvider>
    <AppContent />
  </DbProvider>
);

export default App;
