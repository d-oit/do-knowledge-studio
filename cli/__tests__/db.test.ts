import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { initDb } from '../db';

describe('CLI Database', () => {
  const testDbPath = path.join(process.cwd(), 'test-cli.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  afterEach(async () => {
    const db = await initDb(testDbPath);
    await db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
  });

  it('initializes database at custom path', async () => {
    const db = await initDb(testDbPath);
    expect(fs.existsSync(testDbPath)).toBe(true);
    expect(db.exec).toBeDefined();
    await db.close();
  });

  it('runs schema on initialization', async () => {
    const db = await initDb(testDbPath);
    // Querying a table that should exist in schema
    const result = await db.exec({
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='entities'",
      returnValue: 'resultRows'
    }) as any[];
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('entities');
    await db.close();
  });

  it('performs exec operations', async () => {
    const db = await initDb(testDbPath);
    await db.exec({
      sql: 'INSERT INTO entities (id, name, type) VALUES (?, ?, ?)',
      bind: ['test-id', 'Test Entity', 'note']
    });

    const rows = await db.exec({
      sql: 'SELECT * FROM entities WHERE id = ?',
      bind: ['test-id'],
      returnValue: 'resultRows'
    }) as any[];

    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Test Entity');
    await db.close();
  });
});
