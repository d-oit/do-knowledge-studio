/**
 * Mind map tree builder - Pure data transformation for mind map rendering.
 *
 * Builds a hierarchical tree from a flat (entities, links) pair, suitable for
 * consumption by mind-elixir or any other tree-based renderer. All functions
 * are pure (no React, no I/O) for unit-testability.
 *
 * @see ADR-014 Test Architecture: Pure Data Transforms
 */

import type { Entity, Link } from './validation';

export interface MindMapNode {
  id: string;
  topic: string;
  children: MindMapNode[];
}

export const DEFAULT_MAX_DEPTH = 10;
export const ALL_RELATIONS = 'all';

export interface BuildTreeOptions {
  rootId: string;
  entities: Entity[];
  links: Link[];
  maxDepth?: number;
  relationFilter?: string;
}

export function buildTree(opts: BuildTreeOptions): MindMapNode | null {
  const { rootId, entities, links, maxDepth = DEFAULT_MAX_DEPTH, relationFilter = ALL_RELATIONS } = opts;
  return buildTreeRecursive(rootId, 0, maxDepth, entities, links, relationFilter);
}

function buildTreeRecursive(
  currentId: string,
  depth: number,
  maxDepth: number,
  entities: Entity[],
  links: Link[],
  relationFilter: string,
): MindMapNode | null {
  const entity = entities.find(e => e.id === currentId);
  if (!entity || depth > maxDepth) return null;

  const childrenLinks = links.filter(
    l =>
      l.source_id === currentId &&
      (relationFilter === ALL_RELATIONS || l.relation === relationFilter),
  );

  return {
    id: entity.id,
    topic: entity.name,
    children: childrenLinks
      .map(l =>
        buildTreeRecursive(l.target_id, depth + 1, maxDepth, entities, links, relationFilter),
      )
      .filter((n): n is MindMapNode => n !== null),
  };
}

export function collectRelations(links: Link[]): string[] {
  const relations = new Set<string>([ALL_RELATIONS]);
  for (const link of links) {
    if (link.relation) relations.add(link.relation);
  }
  return Array.from(relations);
}
