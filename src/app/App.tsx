import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { DbProvider, useDb } from '../db/DbProvider';
import { repository } from '../db/repository';
import { logger } from '../lib/logger';
import { hydrateOramaIndex } from '../lib/search';
import { Entity, Link } from '../lib/validation';
import '../styles/index.css';
import LoadingSpinner from '../components/LoadingSpinner';
import SidebarNav from '../components/SidebarNav';
import Header from '../components/Header';
import MobileDrawer from '../components/MobileDrawer';
import SearchPanel, { SearchResult } from '../features/search/SearchPanel';
import { GraphControls } from '../features/graph/GraphControls';

const Editor = lazy(() => import('../features/editor/Editor'));
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

  // Shared state for GraphView mobile controls
  const [graphFocusMode, setGraphFocusMode] = useState(false);
  const [graphSelectedNode, setGraphSelectedNode] = useState<string | null>(null);

  const handleSearchResultClick = useCallback((result: SearchResult) => {
    if (result.type === 'claim' || result.type === 'entity' || result.type === 'note' || result.type === 'concept' || result.type === 'person' || result.type === 'project') {
       setCurrentView('editor');
       // In a real app we would navigate to the specific entity.
       // For now, navigating to the editor is a good start.
    }
    setIsSearchOpen(false);
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

  if (error) return <div className="error-screen">{error}</div>;

  return (
    <div className="layout-container">
      <Header
        onMenuClick={() => setIsMenuOpen(true)}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      <div className="layout-body">
        <aside className="desktop-sidebar">
          <SidebarNav currentView={currentView} setCurrentView={setCurrentView} />
        </aside>

        <main className="main-content">
          {!dbReady && <div className="loading-screen">Booting Knowledge Studio...</div>}
          <Suspense fallback={<LoadingSpinner />}>
            {dbReady && currentView === 'editor' && <Editor />}
            {dbReady && currentView === 'graph' && (
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
            {dbReady && currentView === 'mindmap' && entities.length > 0 && (
              <MindMapView
                rootEntity={entities[0]}
                relatedEntities={entities.slice(1, 10)}
              />
            )}
            {dbReady && currentView === 'mindmap' && entities.length === 0 && (
               <div className="empty-state">No entities found. Create some in the Editor first.</div>
            )}
            {dbReady && currentView === 'chat' && <Chat />}
            {dbReady && currentView === 'export' && <ExportPanel />}
            {dbReady && currentView === 'ai' && <AIHarness />}
          </Suspense>
        </main>

        <aside className="search-sidebar">
          <SearchPanel onResultClick={handleSearchResultClick} />
        </aside>
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
            <GraphControls
              focusMode={graphFocusMode}
              setFocusMode={setGraphFocusMode}
              hasSelection={!!graphSelectedNode}
              selectedName={entities.find(e => e.id === graphSelectedNode)?.name}
            />
          </div>
        )}
      </MobileDrawer>

      {isSearchOpen && (
        <div className="mobile-search-overlay">
          <SearchPanel
            isMobile
            onClose={() => setIsSearchOpen(false)}
            onResultClick={handleSearchResultClick}
          />
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => (
  <DbProvider>
    <AppContent />
  </DbProvider>
);

export default App;
