/* eslint-disable @typescript-eslint/unbound-method -- all methods are mock/stub methods, not real instance methods */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../src/db/client.js', () => ({
  setDb: vi.fn(),
}));

vi.mock('../../src/db/repository.js', () => ({
  repository: {
    createEntity: vi.fn().mockResolvedValue({
      id: 'test-entity-id',
      name: 'TestEntity',
      type: 'concept',
      description: 'A test entity',
      metadata: {},
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    }),
    getAllEntities: vi.fn().mockResolvedValue([
      { id: 'entity-1', name: 'Alpha', type: 'concept' },
      { id: 'entity-2', name: 'Beta', type: 'note' },
    ]),
    getEntityByName: vi.fn().mockImplementation((name: string) => {
      if (name === 'Alpha') {
        return { id: 'entity-1', name: 'Alpha', type: 'concept', description: 'Alpha desc', created_at: '2024-01-01', updated_at: '2024-01-02' };
      }
      return null;
    }),
    updateEntity: vi.fn().mockResolvedValue({ id: 'entity-1', name: 'Alpha', type: 'updated' }),
    deleteEntity: vi.fn().mockResolvedValue(undefined),
    createClaim: vi.fn().mockResolvedValue({ id: 'claim-1', statement: 'Test statement' }),
    createLink: vi.fn().mockResolvedValue({ id: 'link-1', source_id: 'entity-1', target_id: 'entity-2', relation: 'related' }),
    getAllLinks: vi.fn().mockResolvedValue([
      { id: 'link-1', source_id: 'entity-1', target_id: 'entity-2', relation: 'related' },
    ]),
    deleteLink: vi.fn().mockResolvedValue(undefined),
    createNote: vi.fn().mockResolvedValue({ id: 'note-1', content: 'Note content' }),
    getNotesByEntityId: vi.fn().mockResolvedValue([
      { id: 'note-1', content: 'Note content here' },
    ]),
    searchEntities: vi.fn().mockResolvedValue([
      { id: 'entity-1', name: 'Alpha', type: 'concept', description: 'Alpha desc' },
    ]),
    listSnapshots: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../db.js', () => ({
  initDb: vi.fn().mockResolvedValue({
    exec: vi.fn(),
    close: vi.fn(),
    transaction: vi.fn(),
  }),
  getDefaultDbPath: vi.fn().mockReturnValue('/tmp/test.db'),
}));

vi.mock('../../src/db/migrate.js', () => ({
  runMigrations: vi.fn().mockResolvedValue({ applied: [], errors: [] }),
  rollbackLastMigration: vi.fn().mockResolvedValue(undefined),
  getMigrationStatus: vi.fn().mockResolvedValue([]),
}));

import { registerEntityCommands } from '../commands/entity.js';
import { registerClaimCommands } from '../commands/claim.js';
import { registerLinkCommands } from '../commands/link.js';
import { registerNoteCommands } from '../commands/note.js';
import { registerSearchCommands } from '../commands/search.js';
import { registerDbCommands } from '../commands/db.js';
import { repository } from '../../src/db/repository.js';

let logOutput: string[];
let errorOutput: string[];
let originalLog: typeof console.log;
let originalError: typeof console.error;

function captureConsole() {
  logOutput = [];
  errorOutput = [];
  originalLog = console.log;
  originalError = console.error;
  console.log = (...args: unknown[]) => logOutput.push(args.join(' '));
  console.error = (...args: unknown[]) => errorOutput.push(args.join(' '));
}

function restoreConsole() {
  console.log = originalLog;
  console.error = originalError;
}

describe('CLI Commands', () => {
  let program: Command;
  const ensureDb = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    captureConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  describe('entity-create', () => {
    beforeEach(() => {
      registerEntityCommands(program, ensureDb);
    });

    it('creates an entity', async () => {
      await program.parseAsync(['node', 'cli', 'entity-create', 'MyEntity']);
      expect(vi.mocked(repository.createEntity)).toHaveBeenCalled();
      expect(logOutput.some(l => l.includes('Created:'))).toBe(true);
    });

    it('creates entity with type option', async () => {
      await program.parseAsync(['node', 'cli', 'entity-create', 'MyEntity', '-t', 'person']);
      expect(vi.mocked(repository.createEntity)).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'person' })
      );
    });

    it('creates entity with description', async () => {
      await program.parseAsync(['node', 'cli', 'entity-create', 'MyEntity', '-d', 'A description']);
      expect(vi.mocked(repository.createEntity)).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'A description' })
      );
    });
  });

  describe('entity-list', () => {
    beforeEach(() => {
      registerEntityCommands(program, ensureDb);
    });

    it('lists entities', async () => {
      await program.parseAsync(['node', 'cli', 'entity-list']);
      expect(logOutput.some(l => l.includes('Alpha'))).toBe(true);
      expect(logOutput.some(l => l.includes('Beta'))).toBe(true);
    });
  });

  describe('entity-get', () => {
    beforeEach(() => {
      registerEntityCommands(program, ensureDb);
    });

    it('gets entity by name', async () => {
      await program.parseAsync(['node', 'cli', 'entity-get', 'Alpha']);
      expect(logOutput.some(l => l.includes('Name: Alpha'))).toBe(true);
    });

    it('prints error for missing entity', async () => {
      await program.parseAsync(['node', 'cli', 'entity-get', 'Nonexistent']);
      expect(errorOutput.some(l => l.includes('Entity not found'))).toBe(true);
    });
  });

  describe('entity-update', () => {
    beforeEach(() => {
      registerEntityCommands(program, ensureDb);
    });

    it('updates entity type', async () => {
      await program.parseAsync(['node', 'cli', 'entity-update', 'Alpha', '-t', 'updated']);
      expect(vi.mocked(repository.updateEntity)).toHaveBeenCalledWith('entity-1', { type: 'updated' });
      expect(logOutput.some(l => l.includes('Updated:'))).toBe(true);
    });

    it('prints error for missing entity', async () => {
      await program.parseAsync(['node', 'cli', 'entity-update', 'Nonexistent', '-t', 'x']);
      expect(errorOutput.some(l => l.includes('Entity not found'))).toBe(true);
    });

    it('prints no-changes message when no options given', async () => {
      await program.parseAsync(['node', 'cli', 'entity-update', 'Alpha']);
      expect(logOutput.some(l => l.includes('No changes specified'))).toBe(true);
    });
  });

  describe('entity-delete', () => {
    beforeEach(() => {
      registerEntityCommands(program, ensureDb);
    });

    it('deletes entity by name', async () => {
      await program.parseAsync(['node', 'cli', 'entity-delete', 'Alpha']);
      expect(vi.mocked(repository.deleteEntity)).toHaveBeenCalledWith('entity-1');
      expect(logOutput.some(l => l.includes('Deleted: Alpha'))).toBe(true);
    });

    it('prints error for missing entity', async () => {
      await program.parseAsync(['node', 'cli', 'entity-delete', 'Nonexistent']);
      expect(errorOutput.some(l => l.includes('Entity not found'))).toBe(true);
    });
  });

  describe('claim-create', () => {
    beforeEach(() => {
      registerClaimCommands(program, ensureDb);
    });

    it('creates a claim', async () => {
      await program.parseAsync(['node', 'cli', 'claim-create', 'Alpha', 'Test statement']);
      expect(repository.createClaim).toHaveBeenCalled();
      expect(logOutput.some(l => l.includes('Claim added to'))).toBe(true);
    });

    it('prints error for missing entity', async () => {
      await program.parseAsync(['node', 'cli', 'claim-create', 'Nonexistent', 'Statement']);
      expect(errorOutput.some(l => l.includes('Entity not found'))).toBe(true);
    });
  });

  describe('link-create', () => {
    beforeEach(() => {
      registerLinkCommands(program, ensureDb);
    });

    it('creates a link between entities', async () => {
      // Both Alpha entities need to resolve
      (repository.getEntityByName as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        if (name === 'Alpha' || name === 'Beta') {
          return { id: name === 'Alpha' ? 'entity-1' : 'entity-2', name };
        }
        return null;
      });
      await program.parseAsync(['node', 'cli', 'link-create', 'Alpha', 'Beta']);
      expect(repository.createLink).toHaveBeenCalled();
      expect(logOutput.some(l => l.includes('Link created:'))).toBe(true);
    });

    it('prints error for missing source entity', async () => {
      (repository.getEntityByName as ReturnType<typeof vi.fn>).mockImplementation(() => null);
      await program.parseAsync(['node', 'cli', 'link-create', 'Nonexistent', 'Beta']);
      expect(errorOutput.some(l => l.includes('Source entity not found'))).toBe(true);
    });

    it('prints error for missing target entity', async () => {
      (repository.getEntityByName as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        if (name === 'Alpha') return { id: 'entity-1', name: 'Alpha' };
        return null;
      });
      await program.parseAsync(['node', 'cli', 'link-create', 'Alpha', 'Nonexistent']);
      expect(errorOutput.some(l => l.includes('Target entity not found'))).toBe(true);
    });
  });

  describe('note-create', () => {
    beforeEach(() => {
      registerNoteCommands(program, ensureDb);
    });

    it('creates a note', async () => {
      await program.parseAsync(['node', 'cli', 'note-create', 'Alpha', 'Some note content']);
      expect(vi.mocked(repository.createNote)).toHaveBeenCalled();
      expect(logOutput.some(l => l.includes('Note created for'))).toBe(true);
    });

    it('prints error for missing entity', async () => {
      await program.parseAsync(['node', 'cli', 'note-create', 'Nonexistent', 'Content']);
      expect(errorOutput.some(l => l.includes('Entity not found'))).toBe(true);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registerSearchCommands(program, ensureDb);
    });

    it('searches entities', async () => {
      await program.parseAsync(['node', 'cli', 'search', 'test query']);
      expect(vi.mocked(repository.searchEntities)).toHaveBeenCalledWith('test query');
      expect(logOutput.some(l => l.includes('Alpha'))).toBe(true);
    });

    it('prints no-results message', async () => {
      (repository.searchEntities as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      await program.parseAsync(['node', 'cli', 'search', 'nothing']);
      expect(logOutput.some(l => l.includes('No results found'))).toBe(true);
    });

    it('handles search errors', async () => {
      (repository.searchEntities as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('FTS error'));
      await program.parseAsync(['node', 'cli', 'search', 'fail']);
      expect(errorOutput.some(l => l.includes('Search failed'))).toBe(true);
    });
  });

  describe('link-list', () => {
    beforeEach(() => {
      registerLinkCommands(program, ensureDb);
    });

    it('lists links with entity names', async () => {
      await program.parseAsync(['node', 'cli', 'link-list']);
      expect(logOutput.some(l => l.includes('[link-1]'))).toBe(true);
      expect(logOutput.some(l => l.includes('related'))).toBe(true);
    });

    it('prints no-links message', async () => {
      (repository.getAllLinks as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      await program.parseAsync(['node', 'cli', 'link-list']);
      expect(logOutput.some(l => l.includes('No links found'))).toBe(true);
    });
  });

  describe('link-delete', () => {
    beforeEach(() => {
      registerLinkCommands(program, ensureDb);
    });

    it('deletes a link by ID', async () => {
      await program.parseAsync(['node', 'cli', 'link-delete', 'link-1']);
      expect(vi.mocked(repository.deleteLink)).toHaveBeenCalledWith('link-1');
      expect(logOutput.some(l => l.includes('Link deleted: link-1'))).toBe(true);
    });
  });

  describe('note-list', () => {
    beforeEach(() => {
      registerNoteCommands(program, ensureDb);
    });

    it('lists notes for entity', async () => {
      await program.parseAsync(['node', 'cli', 'note-list', 'Alpha']);
      expect(logOutput.some(l => l.includes('[note-1]'))).toBe(true);
    });

    it('prints no-notes message', async () => {
      (repository.getNotesByEntityId as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      await program.parseAsync(['node', 'cli', 'note-list', 'Alpha']);
      expect(logOutput.some(l => l.includes('No notes for Alpha'))).toBe(true);
    });

    it('prints error for missing entity', async () => {
      await program.parseAsync(['node', 'cli', 'note-list', 'Nonexistent']);
      expect(errorOutput.some(l => l.includes('Entity not found'))).toBe(true);
    });
  });

  describe('claim-create with confidence', () => {
    beforeEach(() => {
      registerClaimCommands(program, ensureDb);
    });

    it('creates claim with custom confidence', async () => {
      await program.parseAsync(['node', 'cli', 'claim-create', 'Alpha', 'Statement', '-c', '0.8']);
      expect(vi.mocked(repository.createClaim)).toHaveBeenCalledWith(
        expect.objectContaining({ confidence: 0.8 })
      );
    });
  });

  describe('entity-create error handling', () => {
    beforeEach(() => {
      registerEntityCommands(program, ensureDb);
    });

    it('handles creation errors', async () => {
      (repository.createEntity as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB full'));
      await program.parseAsync(['node', 'cli', 'entity-create', 'FailEntity']);
      expect(errorOutput.some(l => l.includes('Failed to create entity'))).toBe(true);
    });
  });

  describe('entity-list empty', () => {
    beforeEach(() => {
      registerEntityCommands(program, ensureDb);
    });

    it('prints no-entities message', async () => {
      (repository.getAllEntities as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      await program.parseAsync(['node', 'cli', 'entity-list']);
      expect(logOutput.some(l => l.includes('No entities found'))).toBe(true);
    });
  });

  describe('db:status', () => {
    it('shows migration status', async () => {
      const mockDbInstance = {
        exec: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
        transaction: vi.fn(),
      };
      registerDbCommands(program, ensureDb, vi.fn().mockReturnValue(mockDbInstance), vi.fn());
      await program.parseAsync(['node', 'cli', 'db:status']);
      expect(logOutput.some(l => l.includes('No migrations found'))).toBe(true);
    });
  });

  describe('db:backup', () => {
    it('creates a backup to default path', async () => {
      const mockDbInstance = {
        exec: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
        transaction: vi.fn(),
      };
      registerDbCommands(program, ensureDb, vi.fn().mockReturnValue(mockDbInstance), vi.fn());
      await program.parseAsync(['node', 'cli', 'db:backup']);
      expect(logOutput.some(l => l.includes('Backing up database'))).toBe(true);
    });

    it('creates a backup to custom path', async () => {
      const mockExec = vi.fn().mockResolvedValue(undefined);
      const mockDbInstance = {
        exec: mockExec,
        close: vi.fn(),
        transaction: vi.fn(),
      };
      registerDbCommands(program, ensureDb, vi.fn().mockReturnValue(mockDbInstance), vi.fn());
      await program.parseAsync(['node', 'cli', 'db:backup', 'my-backup.db']);
      expect(mockExec).toHaveBeenCalled();
      expect(logOutput.some(l => l.includes('Backing up database'))).toBe(true);
    });
  });

  describe('db:rollback', () => {
    it('rolls back last migration', async () => {
      const mockDbInstance = {
        exec: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
        transaction: vi.fn(),
      };
      registerDbCommands(program, ensureDb, vi.fn().mockReturnValue(mockDbInstance), vi.fn());
      await program.parseAsync(['node', 'cli', 'db:rollback']);
      expect(logOutput.some(l => l.includes('Rolling back last migration'))).toBe(true);
    });
  });

  describe('db:migrate', () => {
    it('runs migrations', async () => {
      const mockDbInstance = {
        exec: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
        transaction: vi.fn(),
      };
      registerDbCommands(program, ensureDb, vi.fn().mockReturnValue(mockDbInstance), vi.fn());
      await program.parseAsync(['node', 'cli', 'db:migrate']);
      expect(logOutput.some(l => l.includes('Running pending migrations'))).toBe(true);
    });
  });

  describe('link-create with relation option', () => {
    beforeEach(() => {
      registerLinkCommands(program, ensureDb);
    });

    it('creates link with custom relation', async () => {
      (repository.getEntityByName as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        if (name === 'Alpha' || name === 'Beta') {
          return { id: name === 'Alpha' ? 'entity-1' : 'entity-2', name };
        }
        return null;
      });
      await program.parseAsync(['node', 'cli', 'link-create', 'Alpha', 'Beta', '-r', 'causes']);
      expect(vi.mocked(repository.createLink)).toHaveBeenCalledWith(
        expect.objectContaining({ relation: 'causes' })
      );
    });
  });

  describe('entity-update with description', () => {
    beforeEach(() => {
      registerEntityCommands(program, ensureDb);
    });

    it('updates entity description', async () => {
      await program.parseAsync(['node', 'cli', 'entity-update', 'Alpha', '-d', 'New desc']);
      expect(vi.mocked(repository.updateEntity)).toHaveBeenCalledWith('entity-1', { description: 'New desc' });
    });
  });
});
