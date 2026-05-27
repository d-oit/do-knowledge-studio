import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

/**
 * SQLite WASM Worker
 * Handles database operations in a single separate thread to avoid UI blocking
 * and manage OPFS exclusive locking.
 */

interface WorkerRequest {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
}

interface ExecPayload {
  sql: string;
  bind?: (string | number | boolean | null)[];
  returnValue?: string;
  rowMode?: string;
}

interface TransactionPayload {
  statements: { sql: string; bind?: (string | number | boolean | null)[] }[];
}

interface SQLiteDB {
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

// The sqlite3 module is loaded once
const sqlite3Promise = sqlite3InitModule({
  print: console.log,
  printErr: console.error,
}) as Promise<Sqlite3Static>;

self.onmessage = async (event: MessageEvent) => {
  const { type, payload, id } = event.data as WorkerRequest;

  try {
    const sqlite3 = await sqlite3Promise;

    switch (type) {
      case 'init': {
        if (!db) {
          if (sqlite3.oo1.OpfsDb) {
            // Using /studio.db in OPFS. Note: we do NOT use ?unlock-asap=1
            db = new sqlite3.oo1.OpfsDb('/studio.db', 'c');
            console.log('Worker: Using OPFS storage');
          } else {
            db = new sqlite3.oo1.DB('/studio.db', 'c');
            console.warn('Worker: OPFS not available, using fallback storage');
          }

          // Optimized pragmas for performance and concurrency
          db.exec('PRAGMA foreign_keys = ON;');
          db.exec('PRAGMA journal_mode = WAL;');
          db.exec('PRAGMA synchronous = NORMAL;');
          db.exec('PRAGMA busy_timeout = 5000;');
        }

        const schemaPayload = payload as { schema?: string } | undefined;
        if (schemaPayload?.schema) {
          db.exec(schemaPayload.schema);
        }

        self.postMessage({ id, type: 'init', success: true });
        break;
      }

      case 'exec': {
        if (!db) {
          throw new Error('Database not initialized in worker');
        }

        const { sql, bind, returnValue, rowMode } = payload as ExecPayload;
        const result = db.exec({
          sql,
          bind,
          returnValue,
          rowMode,
        });

        self.postMessage({ id, type: 'exec', success: true, data: result });
        break;
      }

      case 'transaction': {
        if (!db) {
          throw new Error('Database not initialized in worker');
        }

        const { statements } = payload as TransactionPayload;

        db.exec('BEGIN TRANSACTION;');
        try {
          const results = [];
          for (const stmt of statements) {
            results.push(db.exec({
              sql: stmt.sql,
              bind: stmt.bind,
              returnValue: 'resultRows',
              rowMode: 'object',
            }));
          }
          db.exec('COMMIT;');
          self.postMessage({ id, type: 'transaction', success: true, data: results });
        } catch (err) {
          db.exec('ROLLBACK;');
          throw err;
        }
        break;
      }

      case 'close': {
        if (db) {
          db.close();
          db = null;
        }
        self.postMessage({ id, type: 'close', success: true });
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown worker error';
    console.error(`Worker error (${type}):`, error);
    self.postMessage({
      id,
      type,
      success: false,
      error: message,
    });
  }
};
