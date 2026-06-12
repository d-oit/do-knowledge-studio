import { Command } from 'commander';
import { repository } from '../../src/db/repository.js';

type EnsureDbFn = () => Promise<void>;

export function registerSearchCommands(program: Command, ensureDb: EnsureDbFn): void {
  program
    .command('search')
    .description('Full-text search entities')
    .argument('<query>', 'search query')
    .action(async (query: string) => {
      await ensureDb();
      try {
        const results = await repository.searchEntities(query);
        if (results.length === 0) {
          console.log('No results found.');
          return;
        }
        for (const r of results) {
          const desc = r.description ? ` — ${r.description.slice(0, 80)}` : '';
          console.log(`[${r.type}] ${r.name}${desc}`);
        }
      } catch (err) {
        console.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}
