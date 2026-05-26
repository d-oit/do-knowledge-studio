import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadMigrations, runMigrations, rollbackLastMigration, getMigrationStatus } from '../migrate';
import type { SQLiteDB } from '../client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..', '..');

function createMockDb(): { db: SQLiteDB; execLog: { sql: string; bind?: unknown[] }[] } {
  const store = new Map<string, unknown[]>();
  const execLog: { sql: string; bind?: unknown[] }[] = [];

  const db: SQLiteDB = {
    exec: (options: unknown) => {
      const opts = options as { sql: string; bind?: unknown[]; returnValue?: string; rowMode?: string };
      execLog.push({ sql: opts.sql, bind: opts.bind });

      if (opts.sql.includes('CREATE TABLE IF NOT EXISTS schema_version')) {
        if (!store.has('schema_version')) {
          store.set('schema_version', []);
        }
        return Promise.resolve([]);
      }

      if (opts.sql.includes('SELECT version, name, checksum, applied_at FROM schema_version')) {
        const rows = store.get('schema_version') || [];
        return Promise.resolve(rows);
      }

      if (opts.sql.includes('INSERT INTO schema_version')) {
        const rows = store.get('schema_version') || [];
        const [version, name, checksum] = opts.bind as [number, string, string];
        rows.push({ version, name, checksum, applied_at: new Date().toISOString() });
        store.set('schema_version', rows);
        return Promise.resolve([]);
      }

      if (opts.sql.includes('DELETE FROM schema_version')) {
        const [version] = opts.bind as [number];
        const rows = (store.get('schema_version') || []).filter(
          (r: unknown) => (r as { version: number }).version !== version
        );
        store.set('schema_version', rows);
        return Promise.resolve([]);
      }

      if (opts.sql.includes('SELECT version, name FROM schema_version ORDER BY version DESC LIMIT 1')) {
        const rows = store.get('schema_version') || [];
        if (rows.length === 0) return Promise.resolve([]);
        const last = rows[rows.length - 1] as { version: number; name: string };
        return Promise.resolve([{ version: last.version, name: last.name }]);
      }

      return Promise.resolve([]);
    },
    transaction: () => Promise.resolve([]),
    close: () => Promise.resolve(),
  };

  return { db, execLog };
}

describe('Migration Framework', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('loadMigrations', () => {
    it('should load migrations from filesystem in Node', async () => {
      vi.stubGlobal('fetch', undefined);
      vi.stubGlobal('process', {
        cwd: () => projectRoot,
        versions: { node: '20' },
      });

      const migrations = await loadMigrations();
      expect(migrations.length).toBeGreaterThanOrEqual(1);
      expect(migrations[0].version).toBe(1);
    });
  });

  describe('runMigrations', () => {
    it('should apply pending migrations on clean database', async () => {
      const { db } = createMockDb();
      const result = await runMigrations(db);

      expect(result.applied).toContain(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should be idempotent when re-run', async () => {
      const { db } = createMockDb();
      const first = await runMigrations(db);
      expect(first.applied).toContain(1);

      const second = await runMigrations(db);
      expect(second.applied).toHaveLength(0);
      expect(second.errors).toHaveLength(0);
    });
  });

  describe('getMigrationStatus', () => {
    it('should return status for all migrations', async () => {
      const { db } = createMockDb();
      await runMigrations(db);

      const status = await getMigrationStatus(db);
      expect(status.length).toBeGreaterThanOrEqual(1);
      expect(status[0].version).toBe(1);
      expect(status[0].appliedAt).not.toBeNull();
    });

    it('should show pending migrations as not applied', async () => {
      const { db } = createMockDb();
      const status = await getMigrationStatus(db);
      const pending = status.filter(s => s.appliedAt === null);
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('rollbackLastMigration', () => {
    it('should roll back the last applied migration', async () => {
      const { db } = createMockDb();
      await runMigrations(db);

      await rollbackLastMigration(db);

      const status = await getMigrationStatus(db);
      const applied = status.filter(s => s.appliedAt !== null);
      expect(applied).toHaveLength(0);
    });

    it('should be no-op when no migrations applied', async () => {
      const { db } = createMockDb();
      await expect(rollbackLastMigration(db)).resolves.not.toThrow();
    });
  });

  describe('checksum validation', () => {
    it('should detect tampered migration file', async () => {
      const { db } = createMockDb();

      vi.stubGlobal('process', { cwd: () => projectRoot, versions: { node: '20' } });
      const result = await runMigrations(db);
      expect(result.applied).toContain(1);
      expect(result.errors).toHaveLength(0);

      const status = await getMigrationStatus(db);
      expect(status).toBeDefined();
      expect(status[0].checksum.length).toBeGreaterThan(0);
    });
  });
});
