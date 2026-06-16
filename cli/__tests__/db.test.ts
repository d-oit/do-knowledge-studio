/**
 * Unit tests for the CLI database init/lifecycle module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { initDb, closeDb, getDb, getDefaultDbPath } from '../db.js';

describe('cli/db', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dks-cli-db-'));
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns a default db path under user data dir', () => {
    const p = getDefaultDbPath();
    expect(p).toContain('do-knowledge-studio');
    expect(p.endsWith('data.db')).toBe(true);
  });

  it('initializes a database at a custom path', async () => {
    const dbPath = path.join(tmpDir, 'data.db');
    const instance = await initDb(dbPath);
    expect(instance).toBeDefined();
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(getDb()).toBe(instance);
  });

  it('reuses the existing instance on repeated init calls', async () => {
    const a = await initDb(path.join(tmpDir, 'a.db'));
    const b = await initDb(path.join(tmpDir, 'b.db'));
    expect(b).toBe(a);
  });

  it('creates the parent directory if it does not exist', async () => {
    const nested = path.join(tmpDir, 'nested', 'more', 'data.db');
    await initDb(nested);
    expect(fs.existsSync(nested)).toBe(true);
  });

  it('throws AppError when getDb is called before init', () => {
    expect(() => getDb()).toThrow(/not initialized/i);
  });

  it('closes the connection and clears the singleton', async () => {
    const dbPath = path.join(tmpDir, 'data.db');
    await initDb(dbPath);
    await closeDb();
    expect(() => getDb()).toThrow(/not initialized/i);
  });

  it('runs schema by creating core tables (entities, claims, notes, links)', async () => {
    const dbPath = path.join(tmpDir, 'data.db');
    const instance = await initDb(dbPath);
    const rows = (await instance.exec({
      sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      returnValue: 'resultRows',
    })) as Array<{ name: string }>;
    const names = rows.map(r => r.name);
    expect(names).toContain('entities');
    expect(names).toContain('claims');
    expect(names).toContain('notes');
    expect(names).toContain('links');
  });

  it('can write a row and read it back', async () => {
    const dbPath = path.join(tmpDir, 'data.db');
    const instance = await initDb(dbPath);
    await instance.exec({
      sql: 'INSERT INTO entities (id, name, type) VALUES (?, ?, ?)',
      bind: ['e1', 'Hello', 'concept'],
    });
    const rows = (await instance.exec({
      sql: 'SELECT id, name FROM entities WHERE id = ?',
      bind: ['e1'],
      returnValue: 'resultRows',
    })) as Array<{ id: string; name: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Hello');
  });
});
