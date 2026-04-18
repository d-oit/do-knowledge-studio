import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { DbProvider, useDb } from '../db/DbProvider';
import { repository } from '../db/repository';
import { logger } from '../lib/logger';
import { hydrateOramaIndex } from '../lib/search';
import { Entity, Link } from '../lib/validation';
import '../styles/index.css';
import LoadingSpinner from '../components/LoadingSpinner';

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
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">Knowledge Studio</div>
        <ul className="nav-links">
          <li>
            <button
              className={`nav-button ${currentView === 'editor' ? 'active' : ''}`}
              onClick={() => setCurrentView('editor')}
              aria-current={currentView === 'editor' ? 'page' : undefined}
            >
              Editor
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${currentView === 'graph' ? 'active' : ''}`}
              onClick={() => setCurrentView('graph')}
              aria-current={currentView === 'graph' ? 'page' : undefined}
            >
              Graph
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${currentView === 'mindmap' ? 'active' : ''}`}
              onClick={() => setCurrentView('mindmap')}
              aria-current={currentView === 'mindmap' ? 'page' : undefined}
            >
              Mind Map
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${currentView === 'chat' ? 'active' : ''}`}
              onClick={() => setCurrentView('chat')}
              aria-current={currentView === 'chat' ? 'page' : undefined}
            >
              Chat
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${currentView === 'export' ? 'active' : ''}`}
              onClick={() => setCurrentView('export')}
              aria-current={currentView === 'export' ? 'page' : undefined}
            >
              Export
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${currentView === 'ai' ? 'active' : ''}`}
              onClick={() => setCurrentView('ai')}
              aria-current={currentView === 'ai' ? 'page' : undefined}
            >
              AI Harness
            </button>
          </li>
        </ul>
      </nav>
      <main className="main-content">
        {!dbReady && <div className="loading-screen">Booting Knowledge Studio...</div>}
        <Suspense fallback={<LoadingSpinner />}>
          {dbReady && currentView === 'editor' && <Editor />}
          {dbReady && currentView === 'graph' && <GraphView entities={entities} links={links} />}
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
    </div>
  );
};

const App: React.FC = () => (
  <DbProvider>
    <AppContent />
  </DbProvider>
);

export default App;
