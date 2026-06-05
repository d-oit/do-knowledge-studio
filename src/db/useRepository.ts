import { useContext } from 'react';
import { DbContext } from './DbProvider';
import { IRepository } from './repository';

export function useRepository(): IRepository {
  const context = useContext(DbContext);
  if (!context) {
    throw new Error('useRepository must be used within a DbProvider');
  }
  return context.repository;
}
