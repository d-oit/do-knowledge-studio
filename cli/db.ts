import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { logger } from '../src/lib/logger.js';
import { AppError } from '../src/lib/errors.js';
import type { SQLiteDB } from '../src/db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getDefaultDbPath = (): string => {
  return path.join(os.homedir(), '.local', 'share', 'do-knowledge-studio', 'data.db');
};

const getLockPath = (dbPath: string): string => `${dbPath}.lock`;

const waitForLock = async (lockPath: string, timeout = 10000): Promise<void> => {
  const start = Date.now();
  while (fs.existsSync(lockPath)) {
    if (Date.now() - start > timeout) {
      throw new AppError('Database is locked by another process (timeout)', 'DB_LOCKED');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

let db: Database.Database | null = null;
let instance: SQLiteDB | null = null;

/**
 * Reads the SQL schema file from the public directory.
 */
const getSchema = (): string => {
  const schemaPath = path.resolve(__dirname, '..', 'public', 'db', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    return fs.readFileSync(schemaPath, 'utf-8');
  }
  logger.warn(`Schema file not found at ${schemaPath}, proceeding without schema`);
  return '';
};

/**
 * Converts a better-sqlite3 row (which may use snake_case) to a plain object.
 * better-sqlite3 returns rows as objects with the column names from SQL.
 */
const rowToObject = (row: Record<string, unknown>): Record<string, unknown> => {
  return { ...row };
};

/**
 * Initializes the Node.js SQLite database using better-sqlite3.
 * Creates the database file and runs the schema if it doesn't exist.
 */
export const initDb = (customPath?: string): Promise<SQLiteDB> => {
  if (instance) return Promise.resolve(instance);

  const dbPath = customPath || getDefaultDbPath();

  try {
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    const schemaSql = getSchema();
    if (schemaSql) {
      db.exec(schemaSql);
    }

    instance = {
      exec: async (options: string | {
        sql: string;
        bind?: (string | number | boolean | null)[];
        returnValue?: string;
        rowMode?: string;
      }): Promise<unknown> => {
        const sql = typeof options === 'string' ? options : options.sql;
        const isWrite = !sql.trim().toUpperCase().startsWith('SELECT');
        const lockPath = getLockPath(dbPath);

        if (isWrite) {
          await waitForLock(lockPath);
        }

        if (typeof options === 'string') {
          db!.exec(options);
          return [];
        }

        const { bind, returnValue } = options;
        const stmt = db!.prepare(sql);

        if (returnValue === 'resultRows') {
          const rows = bind ? stmt.all(...bind) : stmt.all();
          const result = (rows as Record<string, unknown>[]).map(rowToObject);
          return Promise.resolve(result);
        }

        if (bind) {
          stmt.run(...bind);
        } else {
          stmt.run();
        }
        return Promise.resolve([]);
      },

      transaction: async (statements: { sql: string; bind?: (string | number | boolean | null)[] }[]): Promise<unknown> => {
        const lockPath = getLockPath(dbPath);
        await waitForLock(lockPath);

        const txn = db!.transaction(() => {
          const results: unknown[] = [];
          for (const s of statements) {
            const stmt = db!.prepare(s.sql);
            const result = s.bind ? stmt.run(...s.bind) : stmt.run();
            results.push(result);
          }
          return results;
        });
        return Promise.resolve(txn());
      },

      close: (): Promise<void> => {
        db?.close();
        db = null;
        instance = null;
      },
    } as SQLiteDB;

    logger.info(`CLI database initialized at ${dbPath}`);
    return instance;
  } catch (err) {
    logger.error('Failed to initialize CLI database', err);
    throw new AppError('Failed to initialize CLI database', 'DB_INIT_FAILED', err);
  }
};

/**
 * Returns the current database instance.
 * Throws if the database has not been initialized.
 */
export const getDb = (): SQLiteDB => {
  if (!instance) {
    throw new AppError('CLI database not initialized', 'DB_NOT_READY');
  }
  return instance;
};

/**
 * Closes the database connection and cleans up.
 */
export const closeDb = async (): Promise<void> => {
  if (instance) {
    await instance.close();
  }
};
