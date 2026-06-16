import type { CommandRegistrar } from './context';

export const registerLinkCommand: CommandRegistrar = (program) => {
  program
    .command('link-create')
    .description('Create a link between two entities')
    .argument('<source>', 'source entity name')
    .argument('<target>', 'target entity name')
    .option('-r, --relation <relation>', 'relation type', 'related')
    .action(async (source: string, target: string, options: { relation?: string }) => {
      const { repository } = await import('../../src/db/repository.js');
      try {
        const sourceEntity = await repository.getEntityByName(source);
        if (!sourceEntity || !sourceEntity.id) {
          console.error(`Source entity not found: ${source}`);
          return;
        }
        const targetEntity = await repository.getEntityByName(target);
        if (!targetEntity || !targetEntity.id) {
          console.error(`Target entity not found: ${target}`);
          return;
        }
        const link = await repository.createLink({
          source_id: sourceEntity.id,
          target_id: targetEntity.id,
          relation: options.relation ?? 'related',
        });
        console.log(`Link created: ${source} --[${link.relation}]--> ${target} (ID: ${link.id})`);
      } catch (err) {
        console.error(`Failed to create link: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  program
    .command('link-list')
    .description('List all links')
    .action(async () => {
      const { repository } = await import('../../src/db/repository.js');
      try {
        const links = await repository.getAllLinks();
        const entities = await repository.getAllEntities();
        const entityMap = new Map<string, string>();
        for (const e of entities) {
          if (e.id) entityMap.set(e.id, e.name);
        }
        if (links.length === 0) {
          console.log('No links found.');
          return;
        }
        for (const link of links) {
          const source = entityMap.get(link.source_id) || link.source_id;
          const target = entityMap.get(link.target_id) || link.target_id;
          console.log(`[${link.id}] ${source} --[${link.relation}]--> ${target}`);
        }
      } catch (err) {
        console.error(`Failed to list links: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  program
    .command('link-delete')
    .description('Delete a link by ID')
    .argument('<id>', 'link ID')
    .action(async (id: string) => {
      const { repository } = await import('../../src/db/repository.js');
      try {
        await repository.deleteLink(id);
        console.log(`Link deleted: ${id}`);
      } catch (err) {
        console.error(`Failed to delete link: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
};
