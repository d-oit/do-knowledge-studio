import type { CommandRegistrar } from './context';

export const registerClaimCommand: CommandRegistrar = (program, ctx) => {
  program
    .command('claim-create')
    .description('Create claim for entity')
    .argument('<entity-name>')
    .argument('<statement>')
    .option('-c, --confidence <confidence>', 'confidence', '1.0')
    .action(async (entityName: string, statement: string, options: { confidence?: string }) => {
      const db = ctx.getDb();
      if (!db) {
        console.error('Database not initialized');
        return;
      }
      const { repository } = await import('../../src/db/repository.js');
      const entity = await repository.getEntityByName(entityName);
      if (!entity || !entity.id) {
        console.error(`Entity not found: ${entityName}`);
        return;
      }
      try {
        const claim = await repository.createClaim({
          entity_id: entity.id,
          statement,
          confidence: parseFloat(options.confidence ?? '1.0'),
        });
        console.log(`Claim added to ${entity.name}: ${claim.statement}`);
      } catch (err) {
        console.error(`Failed to create claim: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
};
