import type { IRepository } from '../../db/repository/types';
import type { EntityExtractionResult } from './entity-extractor';

/**
 * Applies the selected entities and relationships from an AI extraction result to the graph.
 */
export async function applyEntitiesToGraph(
  result: EntityExtractionResult,
  repository: IRepository,
  selectedEntities: string[],
  selectedRelationships: string[],
  sourceNoteId?: string
): Promise<void> {
  const nameToId = new Map<string, string>();

  // 1. Process selected entities
  for (const entity of result.entities) {
    if (!selectedEntities.includes(entity.name)) continue;

    const existing = await repository.getEntityByName(entity.name);
    if (!existing) {
      // Create new entity if it doesn't exist
      const created = await repository.createEntity({
        name: entity.name,
        type: entity.type,
        description: entity.description,
        metadata: {
          sourceNoteId,
          aiExtracted: true
        }
      });
      if (created.id) nameToId.set(entity.name, created.id);
    } else {
      if (existing.id) nameToId.set(entity.name, existing.id);
    }
  }

  // 2. Fetch existing links once if doing batch to avoid N+1 check?
  // For now, simple check for each relationship
  const existingLinks = await repository.getAllLinks();

  for (const rel of result.relationships) {
    const relKey = `${rel.from}->${rel.to}`;
    if (!selectedRelationships.includes(relKey)) continue;

    // Resolve IDs for the from and to entities
    const fromId = nameToId.get(rel.from) || (await repository.getEntityByName(rel.from))?.id;
    const toId = nameToId.get(rel.to) || (await repository.getEntityByName(rel.to))?.id;

    if (fromId && toId) {
      // Check if link already exists to avoid duplicates
      const exists = existingLinks.some(l =>
        l.source_id === fromId &&
        l.target_id === toId &&
        l.relation === rel.label
      );

      if (!exists) {
        await repository.createLink({
          source_id: fromId,
          target_id: toId,
          relation: rel.label,
          metadata: {
            sourceNoteId,
            aiExtracted: true
          }
        });
      }
    }
  }
}
