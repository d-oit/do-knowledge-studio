import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerClaimCommand } from '../commands/claim.js';
import { registerEntityCommand } from '../commands/entity.js';
import { registerExportCommand, registerImportCommand } from '../commands/export.js';
import { registerLinkCommand } from '../commands/link.js';
import { registerNoteCommand } from '../commands/note.js';
import { registerSearchCommand } from '../commands/search.js';
import { registerDbCommand } from '../commands/db.js';
import type { CommandContext } from '../commands/context.js';

const emptyCtx: CommandContext = {
  getDb: () => null,
  outputDir: './test-export',
};

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerClaimCommand(program, emptyCtx);
  registerDbCommand(program, emptyCtx);
  registerEntityCommand(program, emptyCtx);
  registerExportCommand(program, emptyCtx);
  registerImportCommand(program, emptyCtx);
  registerLinkCommand(program, emptyCtx);
  registerNoteCommand(program, emptyCtx);
  registerSearchCommand(program, emptyCtx);
  return program;
}

describe('cli/commands registration', () => {
  it('registers all command groups', () => {
    const program = buildProgram();
    const names = program.commands.map(c => c.name());
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
    const program = buildProgram();
    const exportCmd = program.commands.find(c => c.name() === 'export');
    expect(exportCmd).toBeDefined();
    const opts = exportCmd?.options.map(o => o.long) ?? [];
    expect(opts).toContain('--format');
    expect(opts).toContain('--output');
  });

  it('import command has <file> argument', () => {
    const program = buildProgram();
    const importCmd = program.commands.find(c => c.name() === 'import');
    expect(importCmd).toBeDefined();
  });
});
