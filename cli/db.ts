import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../src/lib/logger.js';
import { AppError } from '../src/lib/errors.js';
import type { SQLiteDB } from '../src/db/client.js';

const DB_PATH = path.resolve(process.cwd(), '.studio-cli.db');

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
export const initDb = async (): Promise<SQLiteDB> => {
  if (instance) return instance;

  try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

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
        if (typeof options === 'string') {
          db!.exec(options);
          return [];
        }

        const { sql, bind, returnValue, rowMode } = options;
        const stmt = db!.prepare(sql);

        if (returnValue === 'resultRows') {
          const rows = bind ? stmt.all(...bind) : stmt.all();
          const result = (rows as Record<string, unknown>[]).map(rowToObject);
          return result;
        }

        bind ? stmt.run(...bind) : stmt.run();
        return [];
      },

      transaction: async (statements: { sql: string; bind?: (string | number | boolean | null)[] }[]): Promise<unknown> => {
        const txn = db!.transaction(() => {
          const results: unknown[] = [];
          for (const s of statements) {
            const stmt = db!.prepare(s.sql);
            const result = s.bind ? stmt.run(...s.bind) : stmt.run();
            results.push(result);
          }
          return results;
        });
        return txn();
      },

      close: async (): Promise<void> => {
        db?.close();
        db = null;
        instance = null;
      },
    };

    logger.info(`CLI database initialized at ${DB_PATH}`);
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
