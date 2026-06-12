import type { MindElixirData } from 'mind-elixir';
import type { Entity, Link } from './validation';

export function buildTree(
  currentId: string,
  depth: number,
  maxDepth: number,
  entities: Entity[],
  links: Link[],
  relationFilter: string,
  visited = new Set<string>(),
): MindElixirData['nodeData'] | null {
  const entity = entities.find(e => e.id === currentId);
  if (!entity || depth > maxDepth || visited.has(currentId)) return null;

  visited.add(currentId);

  const childrenLinks = links.filter(l =>
    l.source_id === currentId &&
    (relationFilter === 'all' || l.relation === relationFilter)
  );

  return {
    id: entity.id || `node-${Math.random()}`,
    topic: entity.name,
    children: childrenLinks
      .map(l => buildTree(l.target_id, depth + 1, maxDepth, entities, links, relationFilter, visited))
      .filter((n): n is MindElixirData['nodeData'] => n !== null)
  };
}
