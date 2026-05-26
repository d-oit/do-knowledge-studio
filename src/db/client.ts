import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { ConnectionPool, DEFAULT_POOL_SIZE } from './connection-pool.js';
import { runMigrations } from './migrate.js';

/**
 * Abstract database interface for SQLite access.
 * Implemented by browser (WASM worker pool) and CLI (better-sqlite3) adapters.
 */
export interface SQLiteDB {
  /** Execute a SQL statement with optional bind parameters and return options. */
  exec: (options: string | {
    sql: string;
    bind?: (string | number | boolean | null)[];
    returnValue?: string;
    rowMode?: string
  }) => Promise<unknown>;
  /** Execute multiple SQL statements in a single transaction with automatic rollback on failure. */
  transaction: (statements: { sql: string; bind?: (string | number | boolean | null)[] }[]) => Promise<unknown>;
  /** Close the database connection, running VACUUM if supported. */
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
        throw new AppError('Failed to load database schema from server', 'DB_INIT_FAILED');
    }
    // Fallback for CLI
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const fs = await import('fs');
        return fs.readFileSync('./public/db/schema.sql', 'utf-8');
      } catch (err) {
        throw new AppError('Failed to load database schema from filesystem', 'DB_INIT_FAILED', err);
      }
    }
    throw new AppError('No schema source available', 'DB_INIT_FAILED');
};

const isBrowser = typeof window !== 'undefined' && typeof Worker !== 'undefined';

/**
 * Initializes the SQLite database.
 * In browser: creates a ConnectionPool with Web Workers running SQLite WASM.
 * In Node.js/CLI: either uses an injected db (via setDb) or falls back to direct WASM.
 * @param options - Optional poolSize for browser worker pool (default: navigator.hardwareConcurrency).
 * @returns The initialized SQLiteDB instance.
 * @throws {AppError} If database initialization fails.
 */
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
        // CLI/Node fallback: Direct initialization (only reached if setDb not used)
        const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm');
        const sqlite3 = await sqlite3InitModule() as Sqlite3Static;
        const db = new sqlite3.oo1.DB('/studio.db', 'c');
        db.exec(schemaSql);
        db.exec('PRAGMA foreign_keys = ON;');

        instance = {
            exec: (options: unknown) => Promise.resolve(db.exec(options)),
            transaction: (statements: { sql: string; bind?: (string | number | boolean | null)[] }[]) => {
                db.exec('BEGIN TRANSACTION;');
                try {
                    const results = statements.map(s => db.exec({ sql: s.sql, bind: s.bind }));
                    db.exec('COMMIT;');
                    return Promise.resolve(results);
                } catch (e) {
                    db.exec('ROLLBACK;');
                    throw e;
                }
            },
            close: () => db.close()
        };
    }

    runMigrations(instance).then(({ applied, errors }) => {
      if (applied.length > 0) {
        logger.info(`Applied migrations: ${applied.join(', ')}`);
      }
      if (errors.length > 0) {
        logger.error(`Migration errors: ${errors.join('; ')}`);
      }
    }).catch((err) => {
      logger.warn('Non-blocking migration check failed, app will continue', err);
    });

    return instance;
  } catch (err) {
    logger.error('Failed to initialize database', err);
    throw new AppError('Failed to initialize database', 'DB_INIT_FAILED', err);
  }
};

/**
 * Returns the current SQLiteDB instance.
 * @returns The active database instance.
 * @throws {AppError} If the database has not been initialized.
 */
export const getDb = (): SQLiteDB => {
  if (!instance) {
     throw new AppError('Database not initialized', 'DB_NOT_READY');
  }
  return instance;
};

/** Allows CLI or other Node.js contexts to inject their own SQLiteDB instance. */
export const setDb = (db: SQLiteDB): void => {
  instance = db;
};
