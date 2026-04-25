import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { DbProvider, useDb } from '../db/DbProvider';
import { repository } from '../db/repository';
import { logger } from '../lib/logger';
import { hydrateOramaIndex, RankedResult } from '../lib/search';
import { Entity, Link } from '../lib/validation';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import '../styles/index.css';
import LoadingSpinner from '../components/LoadingSpinner';
import SidebarNav from '../components/SidebarNav';
import Header from '../components/Header';
import MobileDrawer from '../components/MobileDrawer';
import BottomSheet from '../components/BottomSheet';
import SearchPanel from '../features/search/SearchPanel';
import CommandPalette from '../features/search/CommandPalette';
import ErrorBoundary from '../components/ErrorBoundary';
import Editor from '../features/editor/Editor';

const GraphControls = lazy(() => import('../features/graph/GraphControls'));
const GraphView = lazy(() => import('../features/graph/GraphView'));
const MindMapView = lazy(() => import('../features/mindmap/MindMapView'));
const Chat = lazy(() => import('../features/chat/Chat'));
const ExportPanel = lazy(() => import('../features/export/ExportPanel'));
const AIHarness = lazy(() => import('../features/ai/AIHarness'));

type View = 'editor' | 'graph' | 'mindmap' | 'chat' | 'export' | 'ai';

const AppContent: React.FC = () => {
  const { dbReady, error } = useDb();
  const [currentView, setCurrentView] = useState<View>('editor');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [rightSidebarTab, setRightSidebarTab] = useState<'search' | 'chat'>('search');

  // Shared state for GraphView mobile controls
  const [graphFocusMode, setGraphFocusMode] = useState(false);
  const [graphSelectedNode, setGraphSelectedNode] = useState<string | null>(null);

  const handleSearchResultClick = useCallback((result: RankedResult) => {
    if (result.type === 'claim' || result.type === 'entity' || result.type === 'note' || result.type === 'concept' || result.type === 'person' || result.type === 'project') {
       setCurrentView('editor');
       // In a real app we would navigate to the specific entity.
       // For now, navigating to the editor is a good start.
    }
    setIsSearchOpen(false);
  }, []);

  const [isAIBottomSheetOpen, setIsAIBottomSheetOpen] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768 && (currentView === 'ai' || currentView === 'chat')) {
      setIsAIBottomSheetOpen(true);
    }
  }, [currentView]);

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

  useEffect(() => {
    if (dbReady) {
      logger.info('Knowledge Studio ready');
      refreshData();
      hydrateOramaIndex();
    }
  }, [dbReady, refreshData]);

  useEffect(() => {
    if (dbReady) {
      refreshData();
    }
  }, [currentView, dbReady, refreshData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (error) return <div className="error-screen">{error}</div>;

  return (
    <div className="layout-container">
      <Header
        onMenuClick={() => setIsMenuOpen(true)}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      <div className="layout-body">
        <PanelGroup orientation="horizontal" id="persistence" className="main-panel-group">
          {/* Left Sidebar */}
          <Panel
            className="desktop-sidebar-panel"
            defaultSize={15}
            collapsible
            minSize={10}
            maxSize={20}
          >
            <SidebarNav currentView={currentView} setCurrentView={setCurrentView} />
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* Main Content Area */}
          <Panel minSize={30}>
            <div className="main-content-wrapper">
              {!dbReady && <div className="loading-screen">Booting Knowledge Studio...</div>}
              {dbReady && (
                <PanelGroup orientation="horizontal" className="inner-panel-group">
                  <Panel minSize={30}>
                    <main className="main-scroll-area">
                      <ErrorBoundary fallback={<div className="error-state">Failed to load editor.</div>}>
                        <Suspense fallback={<LoadingSpinner />}>
                          <Editor />
                        </Suspense>
                      </ErrorBoundary>
                    </main>
                  </Panel>

                  <PanelResizeHandle className="resize-handle" />

                  <Panel defaultSize={40} minSize={20}>
                    <aside className="viz-panel">
                      <ErrorBoundary fallback={<div className="error-state">Failed to load visualization.</div>}>
                        <Suspense fallback={<LoadingSpinner />}>
                          {currentView === 'graph' && (
                            <GraphView
                              entities={entities}
                              links={links}
                              focusMode={graphFocusMode}
                              onFocusModeChange={setGraphFocusMode}
                              selectedNode={graphSelectedNode}
                              onSelectedNodeChange={setGraphSelectedNode}
                              hideToolbar={window.innerWidth < 768}
                            />
                          )}
                          {currentView === 'mindmap' && entities.length > 0 && (
                            <MindMapView
                              rootEntity={entities[0]}
                              relatedEntities={entities.slice(1, 10)}
                            />
                          )}
                          {currentView === 'mindmap' && entities.length === 0 && (
                            <div className="empty-state">No entities found for Mind Map.</div>
                          )}
                          {currentView === 'export' && <ExportPanel />}
                          {currentView === 'ai' && <AIHarness />}
                          {currentView !== 'graph' && currentView !== 'mindmap' && currentView !== 'export' && currentView !== 'ai' && (
                            <div className="viz-placeholder">
                              <p>Select Graph, Mind Map, Export or AI view to see content here.</p>
                            </div>
                          )}
                        </Suspense>
                      </ErrorBoundary>
                    </aside>
                  </Panel>
                </PanelGroup>
              )}
            </div>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* Right Sidebar */}
          <Panel
            className="utility-sidebar-panel"
            defaultSize={20}
            collapsible
            minSize={15}
            maxSize={30}
          >
            <div className="utility-sidebar">
              <div className="utility-tabs">
                <button
                  className={rightSidebarTab === 'search' ? 'active' : ''}
                  onClick={() => setRightSidebarTab('search')}
                >
                  Search
                </button>
                <button
                  className={rightSidebarTab === 'chat' ? 'active' : ''}
                  onClick={() => setRightSidebarTab('chat')}
                >
                  AI Chat
                </button>
              </div>
              <div className="utility-content">
                <Suspense fallback={<LoadingSpinner />}>
                  {rightSidebarTab === 'search' && <SearchPanel onResultClick={handleSearchResultClick} />}
                  {rightSidebarTab === 'chat' && <Chat />}
                </Suspense>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <MobileDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)}>
        <SidebarNav
          currentView={currentView}
          setCurrentView={setCurrentView}
          onClose={() => setIsMenuOpen(false)}
        />
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

      <BottomSheet isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)}>
        <SearchPanel
          isMobile
          onClose={() => setIsSearchOpen(false)}
          onResultClick={handleSearchResultClick}
        />
      </BottomSheet>

      <BottomSheet isOpen={isAIBottomSheetOpen} onClose={() => setIsAIBottomSheetOpen(false)}>
        <Suspense fallback={<LoadingSpinner />}>
          {currentView === 'chat' ? <Chat /> : <AIHarness />}
        </Suspense>
      </BottomSheet>
    </div>
  );
};

const App: React.FC = () => (
  <DbProvider>
    <AppContent />
  </DbProvider>
);

export default App;
