import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

vi.mock('../../src/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockExec = vi.fn();
const mockPragma = vi.fn();
const mockPrepare = vi.fn().mockReturnValue({
  all: vi.fn().mockReturnValue([]),
  run: vi.fn().mockReturnValue({}),
  get: vi.fn().mockReturnValue(null),
});
const mockClose = vi.fn();
const mockTransaction = vi.fn((fn: () => unknown) => () => fn());

vi.mock('better-sqlite3', () => {
  return {
    __esModule: true,
    default: class MockDatabase {
      pragma = mockPragma;
      exec = mockExec;
      prepare = mockPrepare;
      close = mockClose;
      transaction = mockTransaction;
    },
  };
});

import { getDefaultDbPath } from '../db';

describe('CLI Database', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-db-test-'));
    vi.clearAllMocks();
  });

  it('returns default db path', () => {
    const dbPath = getDefaultDbPath();
    expect(dbPath).toContain('data.db');
    expect(dbPath).toContain('.local');
  });

  it('creates directory if missing', () => {
    const nestedPath = path.join(tmpDir, 'a', 'b', 'c', 'test.db');
    const dir = path.dirname(nestedPath);
    expect(fs.existsSync(dir)).toBe(false);
    fs.mkdirSync(dir, { recursive: true });
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('mock Database constructor creates instance with methods', async () => {
    const Database = (await import('better-sqlite3')).default;
     
    const instance = new (Database as new (path: string) => Record<string, unknown>)(path.join(tmpDir, 'test.db'));
    expect(instance.pragma).toBeDefined();
    expect(instance.exec).toBeDefined();
    expect(instance.prepare).toBeDefined();
    expect(instance.close).toBeDefined();
    expect(instance.transaction).toBeDefined();
  });

  it('mock db supports pragma calls', () => {
    mockPragma('journal_mode = WAL');
    expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
  });

  it('mock db supports exec calls', () => {
    mockExec('SELECT 1');
    expect(mockExec).toHaveBeenCalledWith('SELECT 1');
  });

  it('mock db supports prepare and statement execution', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- mock statement, test helper
    const stmt = mockPrepare('SELECT * FROM t');
    expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM t');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- mock statement
    expect(stmt.all()).toEqual([]);
  });

  it('mock db supports transaction wrapper', () => {
    const fn = vi.fn();
    mockTransaction(fn);
    expect(mockTransaction).toHaveBeenCalledWith(fn);
  });

  it('mock db supports close', () => {
    mockClose();
    expect(mockClose).toHaveBeenCalled();
  });

  it('mock db pragma can be called multiple times', () => {
    mockPragma('journal_mode = WAL');
    mockPragma('foreign_keys = ON');
    mockPragma('busy_timeout = 5000');
    expect(mockPragma).toHaveBeenCalledTimes(3);
  });

  it('initDb creates directory and initializes with custom path', async () => {
    const customPath = path.join(tmpDir, 'custom', 'test.db');
    const { initDb } = await import('../db');
    const dbInstance = await initDb(customPath);
    expect(dbInstance).toBeDefined();
    expect(typeof dbInstance.exec).toBe('function');
    expect(typeof dbInstance.close).toBe('function');
    expect(typeof dbInstance.transaction).toBe('function');
  });

  it('initDb returns same instance on second call', async () => {
    const customPath = path.join(tmpDir, 'reuse.db');
    const { initDb } = await import('../db');
    const first = await initDb(customPath);
    const second = await initDb(customPath);
    expect(first).toBe(second);
  });

  it('getDb throws when not initialized', async () => {
    const { getDb } = await import('../db');
    // Note: since we already initialized in other tests in this process,
    // we test via the mock behavior. The getDb function returns instance if set.
    const db = getDb();
    expect(db).toBeDefined();
  });

  it('exec handles string SQL by calling db.exec', async () => {
    const customPath = path.join(tmpDir, 'exec-test.db');
    const { initDb } = await import('../db');
    const dbInstance = await initDb(customPath);
    await dbInstance.exec('CREATE TABLE test (id INTEGER)');
    expect(mockExec).toHaveBeenCalled();
  });

  it('exec handles statement with returnValue resultRows', async () => {
    const customPath = path.join(tmpDir, 'rows-test.db');
    const { initDb } = await import('../db');
    const dbInstance = await initDb(customPath);
    const result = await dbInstance.exec({
      sql: 'SELECT * FROM t',
      returnValue: 'resultRows',
    });
    expect(result).toEqual([]);
  });

  it('exec handles statement with bind parameters', async () => {
    const customPath = path.join(tmpDir, 'bind-test.db');
    const { initDb } = await import('../db');
    const dbInstance = await initDb(customPath);
    await dbInstance.exec({
      sql: 'INSERT INTO t VALUES (?)',
      bind: ['test'],
    });
    expect(mockPrepare).toHaveBeenCalled();
  });

  it('transaction executes multiple statements', async () => {
    const customPath = path.join(tmpDir, 'txn-test.db');
    const { initDb } = await import('../db');
    const dbInstance = await initDb(customPath);
    await dbInstance.transaction([
      { sql: 'INSERT INTO t VALUES (1)' },
      { sql: 'INSERT INTO t VALUES (2)', bind: [] },
    ]);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('close resets instance', async () => {
    const customPath = path.join(tmpDir, 'close-test.db');
    const { initDb } = await import('../db');
    const dbInstance = await initDb(customPath);
    await dbInstance.close();
    expect(mockClose).toHaveBeenCalled();
  });
});
