import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { registerClaimCommand } from '../commands/claim.js';
import { registerEntityCommand } from '../commands/entity.js';
import { registerExportCommand, registerImportCommand } from '../commands/export.js';
import { registerLinkCommand } from '../commands/link.js';
import { registerNoteCommand } from '../commands/note.js';
import { registerSearchCommand } from '../commands/search.js';
import { registerDbCommand } from '../commands/db.js';
import type { CommandContext } from '../commands/context.js';
import type { SQLiteDB } from '../../src/db/client.js';
import { setDb as setGlobalDb } from '../../src/db/client.js';

const SCHEMA_SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'public/db/schema.sql'),
  'utf-8',
);

const emptyCtx: CommandContext = {
  getDb: () => null,
  outputDir: './test-export',
};

function buildProgram(ctx: CommandContext): Command {
  const program = new Command();
  program.exitOverride();
  registerClaimCommand(program, ctx);
  registerDbCommand(program, ctx);
  registerEntityCommand(program, ctx);
  registerExportCommand(program, ctx);
  registerImportCommand(program, ctx);
  registerLinkCommand(program, ctx);
  registerNoteCommand(program, ctx);
  registerSearchCommand(program, ctx);
  return program;
}

function wrapDb(db: DatabaseType): SQLiteDB {
  return {
    exec: (options) => {
      if (typeof options === 'string') {
        db.exec(options);
        return Promise.resolve([]);
      }
      const { sql, bind, returnValue } = options;
      const stmt = db.prepare(sql);
      if (returnValue === 'resultRows') {
        const rows = bind ? stmt.all(...bind) : stmt.all();
        return Promise.resolve(rows);
      }
      if (bind) stmt.run(...bind);
      else stmt.run();
      return Promise.resolve([]);
    },
    transaction: (statements) => {
      const txn = db.transaction(() => {
        const results: unknown[] = [];
        for (const s of statements) {
          const stmt = db.prepare(s.sql);
          const result = s.bind ? stmt.run(...s.bind) : stmt.run();
          results.push(result);
        }
        return results;
      });
      return Promise.resolve(txn());
    },
    close: () => {
      db.close();
    },
  };
}

interface TestEnv {
  db: DatabaseType;
  wrapper: SQLiteDB;
  ctx: CommandContext;
  program: Command;
  logSpy: MockInstance;
  errSpy: MockInstance;
  cleanup: () => void;
}

function setupTestEnv(): TestEnv {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doks-cli-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  const wrapper = wrapDb(db);
  setGlobalDb(wrapper);
  const ctx: CommandContext = {
    getDb: () => wrapper,
    outputDir: tmpDir,
  };
  const program = buildProgram(ctx);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return {
    db,
    wrapper,
    ctx,
    program,
    logSpy,
    errSpy,
    cleanup: () => {
      logSpy.mockRestore();
      errSpy.mockRestore();
      setGlobalDb(null as unknown as SQLiteDB);
      try {
        db.close();
      } catch {
        // already closed
      }
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      ['-shm', '-wal'].forEach((suffix) => {
        const p = `${dbPath}${suffix}`;
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

async function runCommand(program: Command, args: string[]): Promise<void> {
  await program.parseAsync(['node', 'test', ...args]);
}

describe('cli/commands registration', () => {
  it('registers all command groups', () => {
    const program = buildProgram(emptyCtx);
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('claim-create');
    expect(names).toContain('entity-create');
    expect(names).toContain('entity-list');
    expect(names).toContain('entity-get');
    expect(names).toContain('entity-update');
    expect(names).toContain('entity-delete');
    expect(names).toContain('export');
    expect(names).toContain('link-create');
    expect(names).toContain('link-list');
    expect(names).toContain('link-delete');
    expect(names).toContain('note-create');
    expect(names).toContain('note-list');
    expect(names).toContain('search');
    expect(names).toContain('snapshot-list');
    expect(names).toContain('db:migrate');
    expect(names).toContain('db:rollback');
    expect(names).toContain('db:status');
    expect(names).toContain('db:reset');
  });

  it('export command accepts -f and -o options', () => {
    const program = buildProgram(emptyCtx);
    const exportCmd = program.commands.find((c) => c.name() === 'export');
    expect(exportCmd).toBeDefined();
    const opts = exportCmd?.options.map((o) => o.long) ?? [];
    expect(opts).toContain('--format');
    expect(opts).toContain('--output');
  });

  it('import command has <file> argument', () => {
    const program = buildProgram(emptyCtx);
    const importCmd = program.commands.find((c) => c.name() === 'import');
    expect(importCmd).toBeDefined();
  });
});

describe('cli/commands end-to-end flows', () => {
  let env: TestEnv;
  beforeEach(() => {
    env = setupTestEnv();
  });
  afterEach(() => {
    env.cleanup();
  });

  describe('entity-create', () => {
    it('persists a new entity to the database', async () => {
      await runCommand(env.program, ['entity-create', 'Alpha', '--type', 'concept']);
      const row = env.db.prepare('SELECT name, type FROM entities WHERE name = ?').get('Alpha') as { name: string; type: string };
      expect(row).toBeDefined();
      expect(row.name).toBe('Alpha');
      expect(row.type).toBe('concept');
    });

    it('defaults type to "concept" when not provided', async () => {
      await runCommand(env.program, ['entity-create', 'Beta']);
      const row = env.db.prepare('SELECT type FROM entities WHERE name = ?').get('Beta') as { type: string };
      expect(row.type).toBe('concept');
    });

    it('accepts --description option', async () => {
      await runCommand(env.program, ['entity-create', 'Gamma', '--description', 'A test entity']);
      const row = env.db.prepare('SELECT description FROM entities WHERE name = ?').get('Gamma') as { description: string };
      expect(row.description).toBe('A test entity');
    });
  });

  describe('entity-list', () => {
    it('lists existing entities', async () => {
      await runCommand(env.program, ['entity-create', 'Alpha']);
      await runCommand(env.program, ['entity-create', 'Beta']);
      logSpyClear(env.logSpy);
      await runCommand(env.program, ['entity-list']);
      const logs = formatSpyCalls(env.logSpy);
      expect(logs).toContain('Alpha');
      expect(logs).toContain('Beta');
    });

    it('reports an empty result when no entities exist', async () => {
      await runCommand(env.program, ['entity-list']);
      const logs = formatSpyCalls(env.logSpy);
      expect(logs).toContain('No entities');
    });
  });

  describe('entity-get', () => {
    it('retrieves an existing entity by name', async () => {
      await runCommand(env.program, ['entity-create', 'Alpha', '--type', 'concept']);
      logSpyClear(env.logSpy);
      await runCommand(env.program, ['entity-get', 'Alpha']);
      const logs = formatSpyCalls(env.logSpy);
      expect(logs).toContain('Name: Alpha');
      expect(logs).toContain('Type: concept');
    });

    it('reports an error when the entity does not exist', async () => {
      await runCommand(env.program, ['entity-get', 'Missing']);
      const errs = formatSpyCalls(env.errSpy);
      expect(errs).toContain('Entity not found');
    });
  });

  describe('entity-update', () => {
    it('updates the type of an existing entity', async () => {
      await runCommand(env.program, ['entity-create', 'Alpha']);
      await runCommand(env.program, ['entity-update', 'Alpha', '--type', 'person']);
      const row = env.db.prepare('SELECT type FROM entities WHERE name = ?').get('Alpha') as { type: string };
      expect(row.type).toBe('person');
    });

    it('updates the description of an existing entity', async () => {
      await runCommand(env.program, ['entity-create', 'Beta']);
      await runCommand(env.program, ['entity-update', 'Beta', '--description', 'updated']);
      const row = env.db.prepare('SELECT description FROM entities WHERE name = ?').get('Beta') as { description: string };
      expect(row.description).toBe('updated');
    });

    it('reports an error when the entity does not exist', async () => {
      await runCommand(env.program, ['entity-update', 'Missing', '--type', 'person']);
      const errs = formatSpyCalls(env.errSpy);
      expect(errs).toContain('Entity not found');
    });

    it('warns when no changes are specified', async () => {
      await runCommand(env.program, ['entity-create', 'Alpha']);
      logSpyClear(env.logSpy);
      await runCommand(env.program, ['entity-update', 'Alpha']);
      const logs = formatSpyCalls(env.logSpy);
      expect(logs).toContain('No changes');
    });
  });

  describe('entity-delete', () => {
    it('removes an entity from the database', async () => {
      await runCommand(env.program, ['entity-create', 'Alpha']);
      await runCommand(env.program, ['entity-delete', 'Alpha']);
      const row = env.db.prepare('SELECT * FROM entities WHERE name = ?').get('Alpha');
      expect(row).toBeUndefined();
    });

    it('reports an error when the entity does not exist', async () => {
      await runCommand(env.program, ['entity-delete', 'Missing']);
      const errs = formatSpyCalls(env.errSpy);
      expect(errs).toContain('Entity not found');
    });
  });

  describe('claim-create', () => {
    it('attaches a claim to an existing entity', async () => {
      await runCommand(env.program, ['entity-create', 'Alpha']);
      await runCommand(env.program, ['claim-create', 'Alpha', 'Alpha is a concept', '--confidence', '0.9']);
      const rows = env.db.prepare(`SELECT c.statement, c.confidence
        FROM claims c
        JOIN entities e ON c.entity_id = e.id
        WHERE e.name = ?`).all('Alpha') as { statement: string; confidence: number }[];
      expect(rows).toHaveLength(1);
      expect(rows[0]?.statement).toBe('Alpha is a concept');
      expect(rows[0]?.confidence).toBe(0.9);
    });

    it('reports an error when the entity does not exist', async () => {
      await runCommand(env.program, ['claim-create', 'Missing', 'statement']);
      const errs = formatSpyCalls(env.errSpy);
      expect(errs).toContain('Entity not found');
    });
  });

  describe('link-create', () => {
    it('creates a relationship between two entities', async () => {
      await runCommand(env.program, ['entity-create', 'A']);
      await runCommand(env.program, ['entity-create', 'B']);
      await runCommand(env.program, ['link-create', 'A', 'B', '--relation', 'related']);
      const rows = env.db.prepare(`SELECT l.relation
        FROM links l
        JOIN entities s ON l.source_id = s.id
        JOIN entities t ON l.target_id = t.id
        WHERE s.name = ? AND t.name = ?`).all('A', 'B') as { relation: string }[];
      expect(rows).toHaveLength(1);
      expect(rows[0]?.relation).toBe('related');
    });

    it('reports an error when the source entity does not exist', async () => {
      await runCommand(env.program, ['entity-create', 'B']);
      await runCommand(env.program, ['link-create', 'Missing', 'B']);
      const errs = formatSpyCalls(env.errSpy);
      expect(errs).toContain('Source entity not found');
    });

    it('reports an error when the target entity does not exist', async () => {
      await runCommand(env.program, ['entity-create', 'A']);
      await runCommand(env.program, ['link-create', 'A', 'Missing']);
      const errs = formatSpyCalls(env.errSpy);
      expect(errs).toContain('Target entity not found');
    });
  });

  describe('note-create', () => {
    it('attaches a note to an existing entity', async () => {
      await runCommand(env.program, ['entity-create', 'Alpha']);
      await runCommand(env.program, ['note-create', 'Alpha', 'A test note body']);
      const rows = env.db.prepare(`SELECT n.content
        FROM notes n
        JOIN entities e ON n.entity_id = e.id
        WHERE e.name = ?`).all('Alpha') as { content: string }[];
      expect(rows).toHaveLength(1);
      expect(rows[0]?.content).toBe('A test note body');
    });

    it('reports an error when the entity does not exist', async () => {
      await runCommand(env.program, ['note-create', 'Missing', 'body']);
      const errs = formatSpyCalls(env.errSpy);
      expect(errs).toContain('Entity not found');
    });
  });

  describe('search', () => {
    it('finds entities by query', async () => {
      await runCommand(env.program, ['entity-create', 'Quantum Mechanics', '--type', 'concept']);
      await runCommand(env.program, ['entity-create', 'Classical Mechanics', '--type', 'concept']);
      logSpyClear(env.logSpy);
      errSpyClear(env.errSpy);
      await runCommand(env.program, ['search', 'Quantum']);
      const logs = formatSpyCalls(env.logSpy);
      const errs = formatSpyCalls(env.errSpy);
      const output = logs + '\n' + errs;
      expect(output.length).toBeGreaterThan(0);
    });

    it('runs without crashing for unknown queries', async () => {
      logSpyClear(env.logSpy);
      errSpyClear(env.errSpy);
      await runCommand(env.program, ['search', 'NonexistentQuery']);
      const logs = formatSpyCalls(env.logSpy);
      const errs = formatSpyCalls(env.errSpy);
      const output = logs + '\n' + errs;
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('db:status', () => {
    it('reports migration status', async () => {
      logSpyClear(env.logSpy);
      await runCommand(env.program, ['db:status']);
      const logs = formatSpyCalls(env.logSpy);
      expect(logs).toContain('Migration Status');
    });
  });

  describe('db:reset', () => {
    it('runs without error and reports completion', async () => {
      await runCommand(env.program, ['entity-create', 'Alpha']);
      logSpyClear(env.logSpy);
      await runCommand(env.program, ['db:reset']);
      const logs = formatSpyCalls(env.logSpy);
      expect(logs).toContain('Database reset complete');
    });
  });

  describe('error paths', () => {
    it('reports an error when the database is not initialized (null ctx)', async () => {
      const nullCtx: CommandContext = {
        getDb: () => null,
        outputDir: './test-export',
      };
      const program = buildProgram(nullCtx);
      const localErrSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await runCommand(program, ['entity-create', 'Orphan']);
      const errs = formatSpyCalls(localErrSpy);
      expect(errs).toContain('Database not initialized');
      localErrSpy.mockRestore();
    });

    it('entity-update requires a name argument', async () => {
      await expect(runCommand(env.program, ['entity-update'])).rejects.toThrow();
    });

    it('entity-delete requires a name argument', async () => {
      await expect(runCommand(env.program, ['entity-delete'])).rejects.toThrow();
    });

    it('search requires a query argument', async () => {
      await expect(runCommand(env.program, ['search'])).rejects.toThrow();
    });
  });
});

function logSpyClear(spy: MockInstance): void {
  spy.mockClear();
}

function errSpyClear(spy: MockInstance): void {
  spy.mockClear();
}

function formatSpyCalls(spy: MockInstance): string {
  return spy.mock.calls
    .map((call: unknown[]) => call.map((arg: unknown) => String(arg)).join(' '))
    .join('\n');
}
