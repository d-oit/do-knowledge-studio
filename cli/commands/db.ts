import { Command } from 'commander';
import * as path from 'path';
import { setDb } from '../../src/db/client.js';
import { initDb } from '../db.js';
import { runMigrations, rollbackLastMigration, getMigrationStatus } from '../../src/db/migrate.js';

type EnsureDbFn = () => Promise<void>;
type GetDbInstanceFn = () => Awaited<ReturnType<typeof initDb>> | null;
type SetDbInstanceFn = (db: Awaited<ReturnType<typeof initDb>>) => void;

export function registerDbCommands(
  program: Command,
  ensureDb: EnsureDbFn,
  getDbInstance: GetDbInstanceFn,
  setDbInstance: SetDbInstanceFn
): void {
  program
    .command('db:migrate')
    .description('Run pending database migrations')
    .action(async () => {
      await ensureDb();
      const dbInstance = getDbInstance();
      if (!dbInstance) throw new Error('Database not initialized');
      console.log('Running pending migrations...');
      const { applied, errors } = await runMigrations(dbInstance);
      if (applied.length > 0) {
        console.log(`Applied: ${applied.join(', ')}`);
      } else {
        console.log('No pending migrations.');
      }
      if (errors.length > 0) {
        console.error(`Errors: ${errors.join('; ')}`);
      }
    });

  program
    .command('db:rollback')
    .description('Rollback the last migration')
    .action(async () => {
      await ensureDb();
      const dbInstance = getDbInstance();
      if (!dbInstance) throw new Error('Database not initialized');
      console.log('Rolling back last migration...');
      try {
        await rollbackLastMigration(dbInstance);
        console.log('Rollback complete.');
      } catch (err) {
        console.error(`Rollback failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  program
    .command('db:status')
    .description('Show migration status')
    .action(async () => {
      await ensureDb();
      const dbInstance = getDbInstance();
      if (!dbInstance) throw new Error('Database not initialized');
      const statuses = await getMigrationStatus(dbInstance);
      if (statuses.length === 0) {
        console.log('No migrations found.');
        return;
      }
      console.log('Migration Status:');
      for (const s of statuses) {
        const applied = s.appliedAt ?? 'PENDING';
        console.log(`  [${s.version}] ${s.name} — ${applied}`);
      }
    });

  program
    .command('db:backup')
    .description('Backup the SQLite database')
    .argument('[path]', 'output path for the backup file')
    .action(async (pathArg: string | undefined) => {
      await ensureDb();
      const dbInstance = getDbInstance();
      if (!dbInstance) throw new Error('Database not initialized');
      const backupPath = pathArg ?? `.studio-cli-backup-${Date.now()}.db`;
      const resolvedPath = path.resolve(process.cwd(), backupPath);
      console.log(`Backing up database to ${resolvedPath}...`);
      try {
        await dbInstance.exec({ sql: `VACUUM INTO '${resolvedPath.replace(/'/g, "''")}'` });
        console.log(`Backup created: ${resolvedPath}`);
      } catch (err) {
        console.error(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  program
    .command('db:reset')
    .description('Reset the database (drop all tables and re-run schema)')
    .action(async () => {
      await ensureDb();
      const dbInstance = getDbInstance();
      if (!dbInstance) throw new Error('Database not initialized');
      console.log('Resetting database...');
      try {
        await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS claim_search_idx' });
        await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS entity_search_idx' });
        await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS web_cache' });
        await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS graph_snapshots' });
        await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS schema_version' });
        await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS links' });
        await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS notes' });
        await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS claims' });
        await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS entities' });
        const freshDb = await initDb();
        setDb(freshDb);
        setDbInstance(freshDb);
        console.log('Database reset complete.');
      } catch (err) {
        console.error(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}
