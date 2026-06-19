import type { Entity, Link } from './validation';

interface MindMapNode {
  id: string;
  topic: string;
  children: MindMapNode[];
}

/**
 * Builds a tree structure from entities and links for mind map visualization.
 *
 * @param currentId - The ID of the current entity to start from
 * @param depth - Current depth in the tree
 * @param maxDepth - Maximum depth to traverse
 * @param entities - Array of all entities
 * @param links - Array of all links between entities
 * @param relationFilter - Filter for link relations ('all' for no filter)
 * @returns Tree node or null if entity not found or depth exceeded
 */
export function buildTree(
  currentId: string,
  depth: number,
  maxDepth: number,
  entities: Entity[],
  links: Link[],
  relationFilter: string,
): MindMapNode | null {
  const entity = entities.find(e => e.id === currentId);
  if (!entity || depth > maxDepth) return null;

  const childrenLinks = links.filter(l =>
    l.source_id === currentId &&
    (relationFilter === 'all' || l.relation === relationFilter)
  );

  return {
    id: entity.id || `node-${Math.random()}`,
    topic: entity.name,
    children: childrenLinks
      .map(l => buildTree(l.target_id, depth + 1, maxDepth, entities, links, relationFilter))
      .filter((n): n is MindMapNode => n !== null)
  };
}

/**
 * Adds ARIA attributes to mind map nodes for accessibility.
 *
 * @param container - The container element containing mind map nodes
 */
export function addAriaToNodes(container: HTMLElement): void {
  const topics = container.querySelectorAll('me-tpc');
  topics.forEach(tpc => {
    const parent = tpc.closest('me-parent');
    if (parent && !parent.hasAttribute('role')) {
      parent.setAttribute('role', 'treeitem');
      parent.setAttribute('aria-label', tpc.textContent?.trim() || 'Mind map node');
    }
  });
}
