import type { CommandRegistrar } from './context';

export const registerSearchCommand: CommandRegistrar = (program) => {
  program
    .command('search')
    .description('Full-text search entities')
    .argument('<query>', 'search query')
    .action(async (query: string) => {
      const { repository } = await import('../../src/db/repository.js');
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

  program
    .command('snapshot-list')
    .description('List graph snapshots')
    .action(async () => {
      const { repository } = await import('../../src/db/repository.js');
      try {
        const snapshots = await repository.listSnapshots();
        if (snapshots.length === 0) {
          console.log('No snapshots found.');
          return;
        }
        for (const snap of snapshots) {
          const nodeCount = (() => {
            try {
              return (JSON.parse(snap.nodes_json) as { id: string }[]).length;
            } catch {
              return 0;
            }
          })();
          const edgeCount = (() => {
            try {
              return (JSON.parse(snap.edges_json) as { id: string }[]).length;
            } catch {
              return 0;
            }
          })();
          console.log(
            `[${snap.id}] ${snap.name} — ${nodeCount} nodes, ${edgeCount} edges — ${snap.created_at}`,
          );
          if (snap.description) console.log(`  ${snap.description}`);
        }
      } catch (err) {
        console.error(`Failed to list snapshots: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
};
