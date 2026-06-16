import type { CommandRegistrar } from './context';

export const registerNoteCommand: CommandRegistrar = (program) => {
  program
    .command('note-create')
    .description('Create a note for an entity')
    .argument('<entity>', 'entity name')
    .argument('<content>', 'note content')
    .action(async (entityName: string, content: string) => {
      const { repository } = await import('../../src/db/repository.js');
      try {
        const entity = await repository.getEntityByName(entityName);
        if (!entity || !entity.id) {
          console.error(`Entity not found: ${entityName}`);
          return;
        }
        const note = await repository.createNote({
          entity_id: entity.id,
          content,
        });
        console.log(`Note created for ${entityName} (ID: ${note.id})`);
      } catch (err) {
        console.error(`Failed to create note: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  program
    .command('note-list')
    .description('List notes for an entity')
    .argument('<entity>', 'entity name')
    .action(async (entityName: string) => {
      const { repository } = await import('../../src/db/repository.js');
      try {
        const entity = await repository.getEntityByName(entityName);
        if (!entity || !entity.id) {
          console.error(`Entity not found: ${entityName}`);
          return;
        }
        const notes = await repository.getNotesByEntityId(entity.id);
        if (notes.length === 0) {
          console.log(`No notes for ${entityName}.`);
          return;
        }
        for (const note of notes) {
          console.log(`[${note.id}] ${note.content.slice(0, 120)}${note.content.length > 120 ? '...' : ''}`);
        }
      } catch (err) {
        console.error(`Failed to list notes: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
};
