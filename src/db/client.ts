import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import * as fs from 'fs';

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

// Mocking fetch for CLI/Node environment if needed, or using fs
const getSchema = async () => {
    if (typeof fetch !== 'undefined') {
        const schemaResponse = await fetch('/db/schema.sql');
        if (schemaResponse.ok) return await schemaResponse.text();
    }
    // Fallback to local fs for CLI
    return fs.readFileSync('./public/db/schema.sql', 'utf-8');
};

export const initDb = async (): Promise<SQLiteDB> => {
  if (db) return db;

  try {
    // In CLI/Node, we might need a different approach if @sqlite.org/sqlite-wasm doesn't support Node.
    // However, for this task, we will try to stay within the provided stack.
    const sqlite3 = await sqlite3InitModule() as unknown as Sqlite3Static;

    if (sqlite3.oo1.OpfsDb) {
      db = new sqlite3.oo1.OpfsDb('/studio.db', 'c');
      logger.info('Connected to SQLite DB via OPFS');
    } else {
      db = new sqlite3.oo1.DB('/studio.db', 'c');
      logger.warn('OPFS not available, using fallback storage');
    }

    const schemaSql = await getSchema();
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
     // For CLI, we might need to auto-init or mock
     throw new AppError('Database not initialized', 'DB_NOT_READY');
  }
  return db;
};
