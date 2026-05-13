import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { ConnectionPool, DEFAULT_POOL_SIZE } from './connection-pool.js';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

export interface SQLiteDB {
  exec: (options: string | {
    sql: string;
    bind?: (string | number | boolean | null)[];
    returnValue?: string;
    rowMode?: string
  }) => Promise<unknown>;
  close: () => Promise<void> | void;
}

interface Sqlite3Static {
  oo1: {
    DB: new (path: string, mode: string) => {
        exec: (options: unknown) => unknown;
        close: () => void;
    };
  };
}

let instance: SQLiteDB | null = null;

// Mocking fetch for CLI/Node environment if needed, or using fs
const getSchema = async () => {
    if (typeof fetch !== 'undefined') {
        const schemaResponse = await fetch('/db/schema.sql');
        if (schemaResponse.ok) return await schemaResponse.text();
    }
    // Fallback for CLI
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const fs = await import('fs');
        return fs.readFileSync('./public/db/schema.sql', 'utf-8');
      } catch {
        return '';
      }
    }
    return '';
};

const isBrowser = typeof window !== 'undefined' && typeof Worker !== 'undefined';

export const initDb = async (options?: { poolSize?: number }): Promise<SQLiteDB> => {
  if (instance) return instance;

  try {
    const schemaSql = await getSchema();

    if (isBrowser) {
        const poolSize = options?.poolSize ?? DEFAULT_POOL_SIZE;
        const pool = new ConnectionPool(poolSize);
        await pool.init(schemaSql);
        instance = pool;
    } else {
        // CLI/Node fallback: Direct initialization
        const sqlite3 = await sqlite3InitModule() as unknown as Sqlite3Static;
        const db = new sqlite3.oo1.DB('/studio.db', 'c');
        db.exec(schemaSql);
        db.exec('PRAGMA foreign_keys = ON;');

        instance = {
            exec: (options: unknown) => Promise.resolve(db.exec(options)),
            close: () => db.close()
        };
    }

    return instance;
  } catch (err) {
    logger.error('Failed to initialize database', err);
    throw new AppError('Failed to initialize database', 'DB_INIT_FAILED', err);
  }
};

export const getDb = (): SQLiteDB => {
  if (!instance) {
     throw new AppError('Database not initialized', 'DB_NOT_READY');
  }
  return instance;
};
