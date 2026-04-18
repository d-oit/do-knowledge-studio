import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { initDb } from '../db/client';
import { repository } from '../db/repository';
import { logger } from '../lib/logger';
import { Entity, Link } from '../lib/validation';
import '../styles/index.css';

const Editor = lazy(() => import('../features/editor/Editor'));
const GraphView = lazy(() => import('../features/graph/GraphView'));
const MindMapView = lazy(() => import('../features/mindmap/MindMapView'));
const Chat = lazy(() => import('../features/chat/Chat'));

type View = 'editor' | 'graph' | 'mindmap' | 'chat';

const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('editor');

  const [entities, setEntities] = useState<Entity[]>([]);
  const [links, setLinks] = useState<Link[]>([]);

  const refreshData = useCallback(async () => {
    try {
      const e = await repository.getAllEntities();
      const l = await repository.getAllLinks();
      setEntities(e);
      setLinks(l);
    } catch (err) {
      logger.error('Data refresh failed', err);
    }
  }, []);

  useEffect(() => {
    initDb()
      .then(() => {
        setDbReady(true);
        logger.info('Knowledge Studio ready');
        refreshData();
      })
      .catch((err) => {
        setError('Failed to initialize local database');
        logger.error('Startup failed', err);
      });
  }, [refreshData]);

  useEffect(() => {
    if (dbReady) {
      refreshData();
    }
  }, [currentView, dbReady, refreshData]);

  if (error) return <div className="error-screen">{error}</div>;
  if (!dbReady) return <div className="loading-screen">Booting Knowledge Studio...</div>;

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
        </ul>
      </nav>
      <main className="main-content">
        <Suspense fallback={<div className="loading-screen">Loading view...</div>}>
          {currentView === 'editor' && <Editor />}
          {currentView === 'graph' && <GraphView entities={entities} links={links} />}
          {currentView === 'mindmap' && entities.length > 0 && (
            <MindMapView
              rootEntity={entities[0]}
              relatedEntities={entities.slice(1, 10)}
            />
          )}
          {currentView === 'mindmap' && entities.length === 0 && (
             <div className="empty-state">No entities found. Create some in the Editor first.</div>
          )}
          {currentView === 'chat' && <Chat />}
        </Suspense>
      </main>
    </div>
  );
};

export default App;
