import type { CommandRegistrar } from './context';

export const registerSyncCommand: CommandRegistrar = (program, ctx) => {
  program
    .command('sync-url')
    .description('Sync a URL into the knowledge base as an entity')
    .argument('<url>')
    .option('-n, --name <name>', 'Entity name (defaults to page title)')
    .option('-t, --type <type>', 'Entity type', 'concept')
    .action(async (url: string, options: { name?: string; type?: string }) => {
      const db = ctx.getDb();
      if (!db) {
        console.error('Database not initialized');
        return;
      }

      const { repository } = await import('../../src/db/repository.js');
      const { resolveUrl } = await import('../../src/lib/resolver.js');

      console.log(`Resolving: ${url}`);
      try {
        const resolved = await resolveUrl(url);

        const entityName = options.name || resolved.title || new URL(url).hostname;
        const description = resolved.title
          ? `${resolved.title}\n\n${resolved.content}`
          : resolved.content;

        const entity = await repository.createEntity({
          name: entityName,
          type: options.type,
          description: description || undefined,
          sourceUrl: url,
        });

        await repository.upsertWebCache(url, resolved.content, resolved.title, resolved.format);

        console.log(`Created entity: ${entity.name} [${entity.type}] (ID: ${entity.id})`);
        console.log(`  Source: ${url}`);
        console.log(`  Provider: ${resolved.provider} (${resolved.wordCount} words)`);
        console.log(`  Cached in web_cache`);
      } catch (err) {
        console.error(`Failed to sync URL: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
};
