import { logger } from '../lib/logger.js';
import type { SQLiteDB } from './client.js';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

export interface MigrationStatus {
  version: number;
  name: string;
  appliedAt: string | null;
  checksum: string;
}

function parseChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function parseMigrationFile(content: string, filename: string): Migration {
  const versionMatch = filename.match(/^(\d+)/);
  if (!versionMatch) throw new Error(`Invalid migration filename: ${filename}`);

  const version = parseInt(versionMatch[1], 10);
  const name = filename.replace(/\.sql$/, '').replace(/^\d+_/, '');

  const upMatch = content.match(/--\s*UP\n([\s\S]*?)(?:\n--\s*DOWN|$)/);
  const downMatch = content.match(/--\s*DOWN\n([\s\S]*)$/);

  if (!upMatch) throw new Error(`Migration ${filename} missing -- UP section`);

  return {
    version,
    name,
    up: upMatch[1].trim(),
    down: downMatch ? downMatch[1].trim() : undefined,
  };
}

async function ensureSchemaVersionTable(db: SQLiteDB): Promise<void> {
  await db.exec({
    sql: `CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  });
}

async function getAppliedMigrations(db: SQLiteDB): Promise<Map<number, MigrationStatus>> {
  const result = await db.exec({
    sql: 'SELECT version, name, checksum, applied_at FROM schema_version ORDER BY version ASC',
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as { version: number; name: string; checksum: string; applied_at: string }[];

  const map = new Map<number, MigrationStatus>();
  for (const row of result) {
    map.set(row.version, {
      version: row.version,
      name: row.name,
      appliedAt: row.applied_at,
      checksum: row.checksum,
    });
  }
  return map;
}

export async function loadMigrations(): Promise<Migration[]> {
  const hasNode = typeof process !== 'undefined' && typeof (process as { versions?: Record<string, string> }).versions?.node === 'string';
  if (hasNode) {
     
    const fs = await import('fs');
    const readFileSync = (p: string, enc: string): string => (fs as { readFileSync: (a: string, b: string) => string }).readFileSync(p, enc);
    const readdirSync = (p: string): string[] => (fs as { readdirSync: (a: string) => string[] }).readdirSync(p);
    const existsSync = (p: string): boolean => (fs as { existsSync: (a: string) => boolean }).existsSync(p);

     
    const pathMod = await import('path');
    const resolve = (...p: string[]): string => (pathMod as { resolve: (...a: string[]) => string }).resolve(...p);
    const join = (...p: string[]): string => (pathMod as { join: (...a: string[]) => string }).join(...p);

     
    const cwd = (process as { cwd: () => string }).cwd();
    const migrationsDir = resolve(cwd, 'public', 'db', 'migrations');
    const migrations: Migration[] = [];

    if (existsSync(migrationsDir)) {
      const entries = readdirSync(migrationsDir);
      for (const f of entries.sort()) {
        if (f.endsWith('.sql')) {
          const content = readFileSync(join(migrationsDir, f), 'utf-8');
          migrations.push(parseMigrationFile(content, f));
        }
      }
    }

    return migrations.sort((a, b) => a.version - b.version);
  }

  const migrationModules = import.meta.glob('/public/db/migrations/*.sql', { query: '?raw', import: 'default' });
  const migrations: Migration[] = [];

  for (const [path, loader] of Object.entries(migrationModules)) {
    try {
      const content = await loader() as string;
      const filename = path.split('/').pop() ?? '';
      migrations.push(parseMigrationFile(content, filename));
    } catch (err) {
      logger.error(`Failed to load migration ${path}`, err);
    }
  }

  return migrations.sort((a, b) => a.version - b.version);
}

export async function runMigrations(db: SQLiteDB): Promise<{ applied: number[]; errors: string[] }> {
  const applied: number[] = [];
  const errors: string[] = [];

  try {
    await ensureSchemaVersionTable(db);
    const appliedMigrations = await getAppliedMigrations(db);
    const migrations = await loadMigrations();

    for (const migration of migrations) {
      if (appliedMigrations.has(migration.version)) {
        const existing = appliedMigrations.get(migration.version)!;
        const expectedChecksum = parseChecksum(migration.up);
        if (existing.checksum !== expectedChecksum) {
          errors.push(`Checksum mismatch for migration ${migration.version} (${migration.name}): expected ${expectedChecksum}, stored ${existing.checksum}`);
        }
        continue;
      }

      try {
        logger.info(`Applying migration ${migration.version}: ${migration.name}`);
        await db.exec({ sql: migration.up });
        const checksum = parseChecksum(migration.up);
        await db.exec({
          sql: `INSERT INTO schema_version (version, name, checksum) VALUES (?, ?, ?)`,
          bind: [migration.version, migration.name, checksum],
        });
        applied.push(migration.version);
        logger.info(`Applied migration ${migration.version}: ${migration.name}`);
      } catch (err) {
        const msg = `Migration ${migration.version} (${migration.name}) failed: ${err instanceof Error ? err.message : String(err)}`;
        logger.error(msg, err);
        errors.push(msg);
      }
    }
  } catch (err) {
    const msg = `Migration system error: ${err instanceof Error ? err.message : String(err)}`;
    logger.error(msg, err);
    errors.push(msg);
  }

  return { applied, errors };
}

export async function rollbackLastMigration(db: SQLiteDB): Promise<void> {
  const result = await db.exec({
    sql: 'SELECT version, name FROM schema_version ORDER BY version DESC LIMIT 1',
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as { version: number; name: string }[];

  if (result.length === 0) {
    logger.info('No migrations to roll back');
    return;
  }

  const { version, name } = result[0];
  const migrations = await loadMigrations();
  const migration = migrations.find(m => m.version === version);

  if (!migration || !migration.down) {
    logger.warn(`Migration ${version} (${name}) has no down script, skipping rollback`);
    return;
  }

  try {
    logger.info(`Rolling back migration ${version}: ${name}`);
    await db.exec({ sql: migration.down });
    await db.exec({
      sql: 'DELETE FROM schema_version WHERE version = ?',
      bind: [version],
    });
    logger.info(`Rolled back migration ${version}: ${name}`);
  } catch (err) {
    logger.error(`Failed to roll back migration ${version}`, err);
    throw err;
  }
}

export async function getMigrationStatus(db: SQLiteDB): Promise<MigrationStatus[]> {
  try {
    await ensureSchemaVersionTable(db);
  } catch (err) {
    logger.debug('ensureSchemaVersionTable failed, returning empty status', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }

  const applied = await getAppliedMigrations(db);
  const migrations = await loadMigrations();
  const allVersions = new Set<number>();

  for (const m of migrations) allVersions.add(m.version);
  for (const v of applied.keys()) allVersions.add(v);

  const statuses: MigrationStatus[] = [];
  for (const version of [...allVersions].sort((a, b) => a - b)) {
    const appliedInfo = applied.get(version);
    const migration = migrations.find(m => m.version === version);
    statuses.push({
      version,
      name: migration?.name ?? appliedInfo?.name ?? 'unknown',
      appliedAt: appliedInfo?.appliedAt ?? null,
      checksum: migration ? parseChecksum(migration.up) : (appliedInfo?.checksum ?? ''),
    });
  }

  return statuses;
}
