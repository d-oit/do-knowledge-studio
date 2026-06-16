import type { CommandRegistrar } from './context';
import { runMigrations, rollbackLastMigration, getMigrationStatus } from '../../src/db/migrate.js';
import { initDb } from '../db.js';
import { setDb } from '../../src/db/client.js';

export const registerDbCommand: CommandRegistrar = (program, ctx) => {
  program
    .command('db:migrate')
    .description('Run pending database migrations')
    .action(async () => {
      const db = ctx.getDb();
      if (!db) {
        console.error('Database not initialized');
        return;
      }
      console.log('Running pending migrations...');
      const { applied, errors } = await runMigrations(db);
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
      const db = ctx.getDb();
      if (!db) {
        console.error('Database not initialized');
        return;
      }
      console.log('Rolling back last migration...');
      try {
        await rollbackLastMigration(db);
        console.log('Rollback complete.');
      } catch (err) {
        console.error(`Rollback failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  program
    .command('db:status')
    .description('Show migration status')
    .action(async () => {
      const db = ctx.getDb();
      if (!db) {
        console.error('Database not initialized');
        return;
      }
      const statuses = await getMigrationStatus(db);
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
    .command('db:reset')
    .description('Reset the database (drop all tables and re-run schema)')
    .action(async () => {
      const db = ctx.getDb();
      if (!db) {
        console.error('Database not initialized');
        return;
      }
      console.log('Resetting database...');
      try {
        db.exec({ sql: 'DROP TABLE IF EXISTS claim_search_idx' });
        db.exec({ sql: 'DROP TABLE IF EXISTS entity_search_idx' });
        db.exec({ sql: 'DROP TABLE IF EXISTS web_cache' });
        db.exec({ sql: 'DROP TABLE IF EXISTS graph_snapshots' });
        db.exec({ sql: 'DROP TABLE IF EXISTS schema_version' });
        db.exec({ sql: 'DROP TABLE IF EXISTS links' });
        db.exec({ sql: 'DROP TABLE IF EXISTS notes' });
        db.exec({ sql: 'DROP TABLE IF EXISTS claims' });
        db.exec({ sql: 'DROP TABLE IF EXISTS entities' });
        const freshDb = await initDb();
        setDb(freshDb);
        console.log('Database reset complete.');
      } catch (err) {
        console.error(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
};
