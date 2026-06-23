import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { initDb, getDb, closeDb, getDefaultDbPath } from '../db.js';

let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doks-db-test-'));
  dbPath = path.join(tmpDir, 'test.db');
});

afterEach(async () => {
  await closeDb();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
  if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('cli/db', () => {
  describe('getDefaultDbPath', () => {
    it('returns a path under the user home directory', () => {
      const result = getDefaultDbPath();
      expect(result).toContain('.local');
      expect(result).toContain('share');
      expect(result).toContain('do-knowledge-studio');
      expect(result.endsWith('data.db')).toBe(true);
    });
  });

  describe('initDb', () => {
    it('creates the database file at the given path', async () => {
      const db = await initDb(dbPath);
      expect(db).toBeDefined();
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('creates the parent directory if it does not exist', async () => {
      const nestedDir = path.join(tmpDir, 'nested', 'sub');
      const nestedPath = path.join(nestedDir, 'cli.db');
      const db = await initDb(nestedPath);
      expect(db).toBeDefined();
      expect(fs.existsSync(nestedPath)).toBe(true);
      expect(fs.existsSync(nestedDir)).toBe(true);
    });

    it('returns the same instance on repeated calls', async () => {
      const first = await initDb(dbPath);
      const second = await initDb(dbPath);
      expect(second).toBe(first);
    });

    it('initializes the schema (entities, claims, notes, links)', async () => {
      const db = await initDb(dbPath);
      const result = (await db.exec({
        sql: `SELECT name FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name`,
        returnValue: 'resultRows',
      })) as { name: string }[];
      const tableNames = result.map((r) => r.name);
      expect(tableNames).toContain('entities');
      expect(tableNames).toContain('claims');
      expect(tableNames).toContain('notes');
      expect(tableNames).toContain('links');
      expect(tableNames).toContain('graph_snapshots');
    });

    it('initializes the FTS5 virtual tables', async () => {
      const db = await initDb(dbPath);
      const result = (await db.exec({
        sql: `SELECT name FROM sqlite_master
              WHERE sql LIKE '%VIRTUAL TABLE%fts5%'
              ORDER BY name`,
        returnValue: 'resultRows',
      })) as { name: string }[];
      const names = result.map((r) => r.name);
      expect(names).toContain('entity_search_idx');
      expect(names).toContain('claim_search_idx');
    });

    it('enables foreign keys', async () => {
      const db = await initDb(dbPath);
      const result = (await db.exec({
        sql: `PRAGMA foreign_keys`,
        returnValue: 'resultRows',
      })) as { foreign_keys: number }[];
      expect(result[0]?.foreign_keys).toBe(1);
    });

    it('supports basic CRUD via exec', async () => {
      const db = await initDb(dbPath);
      await db.exec({
        sql: `INSERT INTO entities (name, type) VALUES (?, ?)`,
        bind: ['Test Entity', 'concept'],
      });
      const rows = (await db.exec({
        sql: `SELECT name, type FROM entities WHERE name = ?`,
        bind: ['Test Entity'],
        returnValue: 'resultRows',
      })) as { name: string; type: string }[];
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe('Test Entity');
      expect(rows[0]?.type).toBe('concept');
    });

    it('supports exec with raw SQL string', async () => {
      const db = await initDb(dbPath);
      const result = await db.exec('INSERT INTO entities (name, type) VALUES (\'Raw\', \'concept\')');
      expect(result).toEqual([]);
      const row = (await db.exec({
        sql: `SELECT name FROM entities WHERE name = ?`,
        bind: ['Raw'],
        returnValue: 'resultRows',
      })) as { name: string }[];
      expect(row[0]?.name).toBe('Raw');
    });

    it('supports exec without bind values', async () => {
      const db = await initDb(dbPath);
      const result = await db.exec({
        sql: `INSERT INTO entities (name, type) VALUES ('NoBind', 'concept')`,
      });
      expect(result).toEqual([]);
    });

    it('supports transactions', async () => {
      const db = await initDb(dbPath);
      const result = (await db.transaction([
        { sql: `INSERT INTO entities (name, type) VALUES ('TX1', 'concept')` },
        { sql: `INSERT INTO entities (name, type) VALUES ('TX2', 'person')` },
      ])) as { changes: number }[];
      expect(result).toHaveLength(2);
      const rows = (await db.exec({
        sql: `SELECT COUNT(*) as count FROM entities`,
        returnValue: 'resultRows',
      })) as { count: number }[];
      expect(rows[0]?.count).toBe(2);
    });

    it('rolls back transactions on error', async () => {
      const db = await initDb(dbPath);
      await db.exec({ sql: `INSERT INTO entities (name, type) VALUES ('Existing', 'concept')` });
      try {
        await db.transaction([
          { sql: `INSERT INTO entities (name, type) VALUES ('TX', 'concept')` },
          { sql: `INSERT INTO entities (name, type) VALUES ('Existing', 'concept')` },
        ]);
      } catch {
        // expected
      }
      const rows = (await db.exec({
        sql: `SELECT name FROM entities WHERE name = ?`,
        bind: ['TX'],
        returnValue: 'resultRows',
      })) as { name: string }[];
      expect(rows).toHaveLength(0);
    });

    it('rejects with an AppError when initialization fails', async () => {
      await closeDb();
      const invalidPath = '/this/path/should/not/be/creatable/\u0000/db.db';
      let caught = false;
      try {
        await initDb(invalidPath);
      } catch (err) {
        caught = true;
        expect(String(err)).toContain('Failed to initialize CLI database');
      }
      expect(caught).toBe(true);
    });
  });

  describe('getDb', () => {
    it('returns the current instance after initDb', async () => {
      const db = await initDb(dbPath);
      expect(getDb()).toBe(db);
    });

    it('throws when the database has not been initialized', () => {
      expect(() => getDb()).toThrow();
    });
  });

  describe('closeDb', () => {
    it('releases the singleton instance', async () => {
      await initDb(dbPath);
      await closeDb();
      expect(() => getDb()).toThrow();
    });

    it('is a no-op when no instance is open', async () => {
      await expect(closeDb()).resolves.toBeUndefined();
    });
  });
});
