import React, { createContext, useContext, useState, useEffect } from 'react';
import { initDb } from './client';
import { logger } from '../lib/logger';

interface DbContextType {
  dbReady: boolean;
  error: string | null;
}

const DbContext = createContext<DbContextType | undefined>(undefined);

export const DbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDb()
      .then(() => {
        setDbReady(true);
        logger.info('Database initialized in DbProvider');
      })
      .catch((err) => {
        setError('Failed to initialize local database');
        logger.error('Database initialization failed', err);
      });
  }, []);

  return (
    <DbContext.Provider value={{ dbReady, error }}>
      {children}
    </DbContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDb = () => {
  const context = useContext(DbContext);
  if (context === undefined) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return context;
};
