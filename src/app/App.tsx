import React, { useState, useEffect } from 'react';
import { initDb } from '../db/client';
import { repository } from '../db/repository';
import { logger } from '../lib/logger';
import { Entity, Link } from '../lib/validation';
import Editor from '../features/editor/Editor';
import GraphView from '../features/graph/GraphView';
import MindMapView from '../features/mindmap/MindMapView';
import Chat from '../features/chat/Chat';
import '../styles/index.css';

type View = 'editor' | 'graph' | 'mindmap' | 'chat';

const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('editor');

  const [entities, setEntities] = useState<Entity[]>([]);
  const [links, setLinks] = useState<Link[]>([]);

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
  }, []);

  const refreshData = async () => {
    try {
      const e = await repository.getAllEntities();
      const l = await repository.getAllLinks();
      setEntities(e);
      setLinks(l);
    } catch (err) {
      logger.error('Data refresh failed', err);
    }
  };

  useEffect(() => {
    if (dbReady) {
      refreshData();
    }
  }, [currentView]);

  if (error) return <div className="error-screen">{error}</div>;
  if (!dbReady) return <div className="loading-screen">Booting Knowledge Studio...</div>;

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">Knowledge Studio</div>
        <ul className="nav-links">
          <li className={currentView === 'editor' ? 'active' : ''} onClick={() => setCurrentView('editor')}>Editor</li>
          <li className={currentView === 'graph' ? 'active' : ''} onClick={() => setCurrentView('graph')}>Graph</li>
          <li className={currentView === 'mindmap' ? 'active' : ''} onClick={() => setCurrentView('mindmap')}>Mind Map</li>
          <li className={currentView === 'chat' ? 'active' : ''} onClick={() => setCurrentView('chat')}>Chat</li>
        </ul>
      </nav>
      <main className="main-content">
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
      </main>
    </div>
  );
};

export default App;
