import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';

export interface SQLiteDB {
  exec: (options: string | {
    sql: string;
    bind?: (string | number | boolean | null)[];
    returnValue?: string;
    rowMode?: string
  }) => unknown[];
  close: () => void;
}

interface Sqlite3Static {
  oo1: {
    DB: new (path: string, mode: string) => SQLiteDB;
    OpfsDb?: new (path: string, mode: string) => SQLiteDB;
  };
}

let db: SQLiteDB | null = null;

export const initDb = async (): Promise<SQLiteDB> => {
  if (db) return db;

  try {
    const sqlite3 = await sqlite3InitModule() as unknown as Sqlite3Static;

    if (sqlite3.oo1.OpfsDb) {
      db = new sqlite3.oo1.OpfsDb('/studio.db', 'c');
      logger.info('Connected to SQLite DB via OPFS');
    } else {
      db = new sqlite3.oo1.DB('/studio.db', 'c');
      logger.warn('OPFS not available, using fallback storage');
    }

    const schemaResponse = await fetch('/db/schema.sql');
    if (!schemaResponse.ok) throw new Error('Failed to fetch schema');
    const schemaSql = await schemaResponse.text();
    db.exec(schemaSql);

    // Enable foreign key support
    db.exec('PRAGMA foreign_keys = ON;');

    return db;
  } catch (err) {
    logger.error('Failed to initialize database', err);
    throw new AppError('Failed to initialize database', 'DB_INIT_FAILED', err);
  }
};

export const getDb = (): SQLiteDB => {
  if (!db) {
    throw new AppError('Database not initialized', 'DB_NOT_READY');
  }
  return db;
};
