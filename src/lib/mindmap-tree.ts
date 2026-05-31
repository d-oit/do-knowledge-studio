import { type MindElixirData } from 'mind-elixir';
import type { Entity, Link } from './validation';

export function buildTree(
  currentId: string,
  depth: number,
  maxDepth: number,
  entities: Entity[],
  links: Link[],
  relationFilter: string,
  visited = new Set<string>()
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
      .map(l => buildTree(l.target_id, depth + 1, maxDepth, entities, links, relationFilter, new Set(visited)))
      .filter((n): n is MindElixirData['nodeData'] => n !== null)
  };
}

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

export function addAriaAttributesToContainer(container: HTMLElement): void {
  container.setAttribute('role', 'tree');
  addAriaToNodes(container);
  const nodeObserver = new MutationObserver(() => { addAriaToNodes(container); });
  nodeObserver.observe(container, { childList: true, subtree: true });
  setTimeout(() => { nodeObserver.disconnect(); }, 2000);
}
