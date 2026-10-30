import type { ValidatedGraph, ValidatedLink, ValidatedMindMap } from './schema'

/** The optional canvas payloads a corpus can carry. */
export interface CanvasSnapshot {
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
}

/** Filters an array without allocating until the first item is removed. */
const filterChanged = <T>(items: T[], keep: (item: T) => boolean): T[] => {
  let filtered: T[] | null = null
  let index = 0
  for (const item of items) {
    if (filtered === null) {
      if (!keep(item)) filtered = items.slice(0, index)
    } else if (keep(item)) {
      filtered.push(item)
    }
    index += 1
  }
  return filtered ?? items
}

/** Removes references to one deleted entity while preserving unchanged fields. */
export const removeCanvasRefs = (canvas: CanvasSnapshot, removedId: string): CanvasSnapshot => {
  const graphNodes = canvas.graph
    ? filterChanged(canvas.graph.nodes, (node) => node.id !== removedId)
    : undefined
  const graphEdges = canvas.graph
    ? filterChanged(
        canvas.graph.edges,
        (edge) => edge.source !== removedId && edge.target !== removedId,
      )
    : undefined
  const mindMapNodes = canvas.mindMap
    ? filterChanged(canvas.mindMap.nodes, (node) => node.id !== removedId)
    : undefined
  const mindMapEdges = canvas.mindMap
    ? filterChanged(
        canvas.mindMap.edges,
        (edge) => edge.source !== removedId && edge.target !== removedId,
      )
    : undefined
  const links = canvas.links
    ? filterChanged(
        canvas.links,
        (link) => link.sourceId !== removedId && link.targetId !== removedId,
      )
    : undefined
  const graphChanged =
    canvas.graph !== undefined &&
    (graphNodes !== canvas.graph.nodes || graphEdges !== canvas.graph.edges)
  const mindMapChanged =
    canvas.mindMap !== undefined &&
    (mindMapNodes !== canvas.mindMap.nodes || mindMapEdges !== canvas.mindMap.edges)
  const linksChanged = links !== undefined && links !== canvas.links
  if (!graphChanged && !mindMapChanged && !linksChanged) return canvas
  return {
    ...canvas,
    ...(graphChanged &&
      canvas.graph && {
        graph: {
          ...canvas.graph,
          nodes: graphNodes ?? canvas.graph.nodes,
          edges: graphEdges ?? canvas.graph.edges,
        },
      }),
    ...(mindMapChanged &&
      canvas.mindMap && {
        mindMap: {
          ...canvas.mindMap,
          nodes: mindMapNodes ?? canvas.mindMap.nodes,
          edges: mindMapEdges ?? canvas.mindMap.edges,
        },
      }),
    ...(linksChanged && { links }),
  }
}

/** Drops canvas edges and links whose endpoints do not name live entities. */
export const pruneDanglingCanvasRefs = (
  canvas: CanvasSnapshot,
  entityIds: ReadonlySet<string>,
): CanvasSnapshot => {
  const graphEdges = canvas.graph
    ? filterChanged(canvas.graph.edges, (edge) => entityIds.has(edge.source) && entityIds.has(edge.target))
    : undefined
  const mindMapEdges = canvas.mindMap
    ? filterChanged(canvas.mindMap.edges, (edge) => entityIds.has(edge.source) && entityIds.has(edge.target))
    : undefined
  const links = canvas.links
    ? filterChanged(canvas.links, (link) => entityIds.has(link.sourceId) && entityIds.has(link.targetId))
    : undefined
  const graphChanged = graphEdges !== undefined && graphEdges !== canvas.graph?.edges
  const mindMapChanged = mindMapEdges !== undefined && mindMapEdges !== canvas.mindMap?.edges
  const linksChanged = links !== undefined && links !== canvas.links
  if (!graphChanged && !mindMapChanged && !linksChanged) return canvas
  return {
    ...canvas,
    ...(graphChanged && canvas.graph && { graph: { ...canvas.graph, edges: graphEdges } }),
    ...(mindMapChanged && canvas.mindMap && { mindMap: { ...canvas.mindMap, edges: mindMapEdges } }),
    ...(linksChanged && { links }),
  }
}
