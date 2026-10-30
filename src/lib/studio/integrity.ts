/**
 * Corpus integrity checker and reconciliation module.
 *
 * Deletion Policy:
 * Single and bulk entity deletion must enforce strict referential integrity across
 * the canonical corpus and all optional canvas/relationship structures.
 *
 * When an entity E with ID `id` (or a set of IDs `S`) is deleted:
 * 1. Entity records: Removed from `entities`.
 * 2. Inbound/Outbound links:
 *    - Outbound links on E are removed with E.
 *    - Inbound links on surviving entities targeting `id` (`link.targetId` in S) are stripped.
 * 3. Claims: All claims attached to `id` (`claim.entityId` in S) are removed.
 * 4. Graph canvas:
 *    - Graph nodes with `node.id` in S are removed.
 *    - Graph edges where `edge.source` or `edge.target` is in S are removed.
 * 5. Mind map canvas:
 *    - Mind map nodes with `node.id` in S are removed.
 *    - Mind map edges where `edge.source` or `edge.target` is in S are removed.
 * 6. Standalone links (`links`): Standalone links where `sourceId` or `targetId` is in S are removed.
 * 7. Selection & Editor state:
 *    - `selectedEntityId` resets to `null` if it matches any ID in S.
 *    - `editingEntityId` resets to `null` if it matches any ID in S.
 * 8. Transactionality & History:
 *    - Single and bulk deletions execute as 1 atomic state update in Zustand, followed by 1 history snapshot (`pushHistory`).
 *    - Undo restores the complete affected corpus in 1 step; Redo re-applies the deletion in 1 step.
 * 9. Boundaries:
 *    - Re-import, hydration, and recovery boundaries run reconciliation to prevent dangling references from entering runtime state or persistence.
 */

import type { ValidatedGraph, ValidatedLink, ValidatedMindMap } from './schema'
import type { Claim, Entity } from './types'

export type IntegrityIssueType =
  | 'dangling_claim'
  | 'dangling_entity_link'
  | 'dangling_standalone_link'
  | 'dangling_graph_edge'
  | 'dangling_mindmap_edge'
  | 'dangling_selection'
  | 'dangling_editing'

export interface IntegrityIssue {
  type: IntegrityIssueType
  id: string
  details: string
}

export interface IntegrityReport {
  valid: boolean
  issues: IntegrityIssue[]
}

export interface CorpusSnapshot {
  entities: Entity[]
  claims: Claim[]
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  selectedEntityId?: string | null
  editingEntityId?: string | null
}

/**
 * Checks a corpus state for any dangling references across claims, entity links,
 * standalone links, graph edges, mind map edges, and selection/editing pointers.
 */
export const verifyCorpusIntegrity = (corpus: CorpusSnapshot): IntegrityReport => {
  const issues: IntegrityIssue[] = []
  const entityIds = new Set(corpus.entities.map((e) => e.id))

  // 1. Check claims
  for (const claim of corpus.claims) {
    if (!entityIds.has(claim.entityId)) {
      issues.push({
        type: 'dangling_claim',
        id: claim.id,
        details: `Claim "${claim.id}" references missing entity "${claim.entityId}".`,
      })
    }
  }

  // 2. Check inline entity links
  for (const entity of corpus.entities) {
    for (const link of entity.links) {
      if (!entityIds.has(link.targetId)) {
        issues.push({
          type: 'dangling_entity_link',
          id: `${entity.id}->${link.targetId}`,
          details: `Entity "${entity.id}" has link targeting missing entity "${link.targetId}".`,
        })
      }
    }
  }

  // 3. Check standalone links
  if (corpus.links) {
    for (const link of corpus.links) {
      if (!entityIds.has(link.sourceId) || !entityIds.has(link.targetId)) {
        issues.push({
          type: 'dangling_standalone_link',
          id: link.id,
          details: `Link "${link.id}" references missing endpoint(s) (${link.sourceId} -> ${link.targetId}).`,
        })
      }
    }
  }

  // 4. Check graph edges
  if (corpus.graph) {
    const graphNodeIds = new Set(corpus.graph.nodes.map((n) => n.id))
    for (const edge of corpus.graph.edges) {
      const sourceValid = graphNodeIds.has(edge.source) || entityIds.has(edge.source)
      const targetValid = graphNodeIds.has(edge.target) || entityIds.has(edge.target)
      if (!sourceValid || !targetValid) {
        issues.push({
          type: 'dangling_graph_edge',
          id: edge.id,
          details: `Graph edge "${edge.id}" references missing endpoint (${edge.source} -> ${edge.target}).`,
        })
      }
    }
  }

  // 5. Check mind map edges
  if (corpus.mindMap) {
    const mindMapNodeIds = new Set(corpus.mindMap.nodes.map((n) => n.id))
    for (const edge of corpus.mindMap.edges) {
      const sourceValid = mindMapNodeIds.has(edge.source) || entityIds.has(edge.source)
      const targetValid = mindMapNodeIds.has(edge.target) || entityIds.has(edge.target)
      if (!sourceValid || !targetValid) {
        issues.push({
          type: 'dangling_mindmap_edge',
          id: edge.id,
          details: `Mind map edge "${edge.id}" references missing endpoint (${edge.source} -> ${edge.target}).`,
        })
      }
    }
  }

  // 6. Check selected and editing entity IDs
  if (corpus.selectedEntityId !== undefined && corpus.selectedEntityId !== null) {
    if (!entityIds.has(corpus.selectedEntityId)) {
      issues.push({
        type: 'dangling_selection',
        id: corpus.selectedEntityId,
        details: `Selected entity ID "${corpus.selectedEntityId}" does not exist in entities.`,
      })
    }
  }

  if (corpus.editingEntityId !== undefined && corpus.editingEntityId !== null) {
    if (!entityIds.has(corpus.editingEntityId)) {
      issues.push({
        type: 'dangling_editing',
        id: corpus.editingEntityId,
        details: `Editing entity ID "${corpus.editingEntityId}" does not exist in entities.`,
      })
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

/**
 * Reconciles a corpus snapshot by pruning any dangling claims, inline links,
 * standalone links, graph edges, mind map edges, and dangling selection/editing pointers.
 */
export const reconcileCorpusIntegrity = <T extends CorpusSnapshot>(corpus: T): T => {
  const entityIds = new Set(corpus.entities.map((e) => e.id))

  // Clean entities (prune dangling inline links)
  let entitiesChanged = false
  const cleanEntities = corpus.entities.map((entity) => {
    const cleanLinks = entity.links.filter((l) => entityIds.has(l.targetId))
    if (cleanLinks.length !== entity.links.length) {
      entitiesChanged = true
      return { ...entity, links: cleanLinks }
    }
    return entity
  })

  // Clean claims (prune orphaned claims)
  const cleanClaims = corpus.claims.filter((c) => entityIds.has(c.entityId))

  // Clean standalone links
  const cleanLinks = corpus.links
    ? corpus.links.filter((l) => entityIds.has(l.sourceId) && entityIds.has(l.targetId))
    : undefined

  // Clean graph
  let cleanGraph = corpus.graph
  if (corpus.graph) {
    const graphNodeIds = new Set(corpus.graph.nodes.map((n) => n.id))
    const cleanEdges = corpus.graph.edges.filter((e) => {
      const sourceValid = graphNodeIds.has(e.source) || entityIds.has(e.source)
      const targetValid = graphNodeIds.has(e.target) || entityIds.has(e.target)
      return sourceValid && targetValid
    })
    if (cleanEdges.length !== corpus.graph.edges.length) {
      cleanGraph = { ...corpus.graph, edges: cleanEdges }
    }
  }

  // Clean mindMap
  let cleanMindMap = corpus.mindMap
  if (corpus.mindMap) {
    const mindMapNodeIds = new Set(corpus.mindMap.nodes.map((n) => n.id))
    const cleanEdges = corpus.mindMap.edges.filter((e) => {
      const sourceValid = mindMapNodeIds.has(e.source) || entityIds.has(e.source)
      const targetValid = mindMapNodeIds.has(e.target) || entityIds.has(e.target)
      return sourceValid && targetValid
    })
    if (cleanEdges.length !== corpus.mindMap.edges.length) {
      cleanMindMap = { ...corpus.mindMap, edges: cleanEdges }
    }
  }

  const cleanSelected =
    corpus.selectedEntityId !== undefined && corpus.selectedEntityId !== null
      ? entityIds.has(corpus.selectedEntityId)
        ? corpus.selectedEntityId
        : null
      : corpus.selectedEntityId

  const cleanEditing =
    corpus.editingEntityId !== undefined && corpus.editingEntityId !== null
      ? entityIds.has(corpus.editingEntityId)
        ? corpus.editingEntityId
        : null
      : corpus.editingEntityId

  return {
    ...corpus,
    entities: entitiesChanged ? cleanEntities : corpus.entities,
    claims: cleanClaims,
    ...(cleanGraph !== undefined && { graph: cleanGraph }),
    ...(cleanMindMap !== undefined && { mindMap: cleanMindMap }),
    ...(cleanLinks !== undefined && { links: cleanLinks }),
    ...(cleanSelected !== undefined && { selectedEntityId: cleanSelected }),
    ...(cleanEditing !== undefined && { editingEntityId: cleanEditing }),
  }
}
