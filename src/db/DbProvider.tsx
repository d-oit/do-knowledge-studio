import React, { createContext, useState, useEffect } from 'react';
import { initDb } from './client';
import { logger } from '../lib/logger';
import { IRepository, repository } from './repository';

interface DbContextType {
  dbReady: boolean;
  error: string | null;
  repository: IRepository;
}

// eslint-disable-next-line react-refresh/only-export-components
export const DbContext = createContext<DbContextType | undefined>(undefined);

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
    <DbContext.Provider value={{ dbReady, error, repository }}>
      {children}
    </DbContext.Provider>
  );
};


