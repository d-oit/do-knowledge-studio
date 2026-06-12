import { Command } from 'commander';
import { repository } from '../../src/db/repository.js';

type EnsureDbFn = () => Promise<void>;

export function registerEntityCommands(program: Command, ensureDb: EnsureDbFn): void {
  program
    .command('entity-create')
    .description('Create entity')
    .argument('<name>')
    .option('-t, --type <type>', 'type', 'concept')
    .option('-d, --description <description>', 'description')
    .option('-u, --source-url <url>', 'source URL for auto-hydration')
    .action(async (name: string, options: { type?: string; description?: string; sourceUrl?: string }) => {
      await ensureDb();
      try {
        const entity = await repository.createEntity({
          name,
          type: options.type ?? 'concept',
          description: options.description,
          metadata: options.sourceUrl ? { source_url: options.sourceUrl } : undefined,
        });
        console.log(`Created: ${entity.name} [${entity.type}] (ID: ${entity.id})`);
        
        // CLI: resolve URL inline (not background) for immediate feedback
        if (options.sourceUrl && entity.id) {
          console.log(`Resolving source URL: ${options.sourceUrl}`);
          try {
            const { resolveUrl } = await import('../../src/lib/resolver.js');
            const resolved = await resolveUrl(options.sourceUrl);
            if (resolved.content) {
              await repository.updateEntity(entity.id, {
                description: resolved.content || undefined,
              });
              console.log(`  Hydrated description from ${resolved.provider} (${resolved.wordCount} words)`);
            }
          } catch (err) {
            console.error(`  Failed to resolve URL: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        console.error(`Failed to create entity: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  program
    .command('entity-list')
    .description('List entities')
    .action(async () => {
      await ensureDb();
      const entities = await repository.getAllEntities();
      if (entities.length === 0) {
        console.log('No entities found.');
        return;
      }
      for (const entity of entities) {
        console.log(`[${entity.type}] ${entity.name}`);
      }
    });

  program
    .command('entity-update')
    .description('Update an entity')
    .argument('<name>', 'entity name')
    .option('-t, --type <type>', 'new type')
    .option('-d, --description <description>', 'new description')
    .action(async (name: string, options: { type?: string; description?: string }) => {
      await ensureDb();
      try {
        const entity = await repository.getEntityByName(name);
        if (!entity || !entity.id) {
          console.error(`Entity not found: ${name}`);
          return;
        }
        const update: Record<string, string> = {};
        if (options.type) update.type = options.type;
        if (options.description) update.description = options.description;
        if (Object.keys(update).length === 0) {
          console.log('No changes specified. Use -t or -d to update fields.');
          return;
        }
        const updated = await repository.updateEntity(entity.id, update);
        console.log(`Updated: ${updated.name} [${updated.type}]`);
      } catch (err) {
        console.error(`Failed to update entity: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  program
    .command('entity-delete')
    .description('Delete an entity and its cascade')
    .argument('<name>', 'entity name')
    .action(async (name: string) => {
      await ensureDb();
      try {
        const entity = await repository.getEntityByName(name);
        if (!entity || !entity.id) {
          console.error(`Entity not found: ${name}`);
          return;
        }
        await repository.deleteEntity(entity.id);
        console.log(`Deleted: ${name}`);
      } catch (err) {
        console.error(`Failed to delete entity: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  program
    .command('entity-get')
    .description('Get an entity by name')
    .argument('<name>', 'entity name')
    .action(async (name: string) => {
      await ensureDb();
      try {
        const entity = await repository.getEntityByName(name);
        if (!entity) {
          console.error(`Entity not found: ${name}`);
          return;
        }
        console.log(`ID: ${entity.id}`);
        console.log(`Name: ${entity.name}`);
        console.log(`Type: ${entity.type}`);
        if (entity.description) console.log(`Description: ${entity.description.slice(0, 200)}`);
        console.log(`Created: ${entity.created_at}`);
        console.log(`Updated: ${entity.updated_at}`);
      } catch (err) {
        console.error(`Failed to get entity: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}
