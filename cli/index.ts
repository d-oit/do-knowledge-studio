/**
 * CLI entry point.
 *
 * Mounts command modules from `cli/commands/*.ts` onto a Commander program.
 * The bulk of each command's logic lives in its own file (per ADR-011).
 */
import { Command } from 'commander';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import { setDb } from '../src/db/client.js';
import { initDb } from './db.js';
import { repository } from '../src/db/repository.js';
import type { Database } from 'better-sqlite3';
import type { CommandContext } from './commands/context.js';
import { registerClaimCommand } from './commands/claim.js';
import { registerDbCommand } from './commands/db.js';
import { registerEntityCommand } from './commands/entity.js';
import { registerExportCommand, registerImportCommand } from './commands/export.js';
import { registerLinkCommand } from './commands/link.js';
import { registerNoteCommand } from './commands/note.js';
import { registerSearchCommand } from './commands/search.js';

const program = new Command();

let dbInstance: Database | null = null;

const ctx: CommandContext = {
  getDb: () => dbInstance,
  outputDir: './export',
};

async function ensureDb(dbPath?: string): Promise<void> {
  if (dbInstance) return;
  dbInstance = await initDb(dbPath);
  setDb(dbInstance);
}

process.on('exit', () => {
  void dbInstance?.close();
});

const version = (() => {
  try {
    return readFileSync(new URL('../VERSION', import.meta.url), 'utf-8').trim();
  } catch {
    return 'unknown';
  }
})();

program
  .name('knowledge-studio')
  .description('CLI for do-knowledge-studio')
  .version(version)
  .option('--db-path <path>', 'custom path to SQLite database file')
  .hook('preAction', async () => {
    const opts = program.opts();
    await ensureDb(opts.dbPath as string | undefined);
  });

program
  .command('init')
  .description('Initialize workspace')
  .action(() => {
    if (!fs.existsSync('./export')) fs.mkdirSync('./export');
    console.log('Workspace initialized.');
  });

program
  .command('sync')
  .description('Sync Markdown files or URL to DB')
  .argument('<source>', 'directory path or URL')
  .action(async (source: string) => {
    const src = String(source);
    if (src.startsWith('http://') || src.startsWith('https://')) {
      console.log(`Syncing from URL: ${src}`);
      try {
        const { resolveUrl } = await import('../src/lib/resolver.js');
        const resolved = await resolveUrl(src);
        await repository.createEntity({
          name: resolved.title || new URL(src).hostname,
          type: 'concept',
          description: resolved.content || undefined,
          metadata: { source_url: src },
        });
        console.log(
          `  Imported: ${resolved.title} (${resolved.wordCount} words via ${resolved.provider})`,
        );
        console.log('Sync complete.');
      } catch (err) {
        console.error(`Failed to sync URL: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
    console.log(`Syncing from "${src}"...`);
    if (!fs.existsSync(src)) {
      console.error('Directory not found');
      return;
    }
    const files = fs.readdirSync(src).filter((f: string) => f.endsWith('.md'));
    console.log(`Found ${files.length} markdown files.`);
    for (const file of files) {
      try {
        const content = fs.readFileSync(`${src}/${file}`, 'utf-8');
        const lines = content.split('\n');
        const title = lines[0].replace('# ', '').trim();
        const description = lines.slice(1).join('\n').trim().slice(0, 200);
        await repository.createEntity({
          name: title,
          type: 'concept',
          description: description || undefined,
        });
        console.log(`  Imported: ${title}`);
      } catch {
        console.log(`  Skipped: ${title} (already exists)`);
      }
    }
    console.log('Sync complete.');
  });

registerClaimCommand(program, ctx);
registerDbCommand(program, ctx);
registerEntityCommand(program, ctx);
registerExportCommand(program, ctx);
registerImportCommand(program, ctx);
registerLinkCommand(program, ctx);
registerNoteCommand(program, ctx);
registerSearchCommand(program, ctx);

program.parse();
