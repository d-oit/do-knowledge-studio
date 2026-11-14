import type { GraphNode } from './types'

/** Direction an arrow key asks the graph to travel in. */
export type GraphNavDirection = 'up' | 'down' | 'left' | 'right'

/** Unit vectors for each direction, in graph coordinates (y grows downward). */
const DIRECTION_VECTORS: Record<GraphNavDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/**
 * How much a sideways offset counts against a candidate, relative to the
 * distance travelled in the requested direction. Above 1 so that a node
 * directly ahead beats a slightly closer one far off to the side.
 */
const PERPENDICULAR_WEIGHT = 2

/** Arrow key → direction, for the graph's roving-tabindex keyboard navigation. */
export const NAV_KEY_DIRECTIONS: Partial<Record<string, GraphNavDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/**
 * Nearest node in `direction` from `currentId`, or `null` if the current node
 * is the last one that way.
 *
 * Distance is scored as forward travel plus perpendicular offset, so arrow keys
 * feel like moving a cursor through the layout rather than jumping to whatever
 * node happens to be closest in a straight line. Ties break by id for
 * deterministic behaviour.
 */
export const findDirectionalNodeId = (
  nodes: readonly GraphNode[],
  currentId: string,
  direction: GraphNavDirection,
): string | null => {
  const current = nodes.find((node) => node.id === currentId)
  if (!current) return null

  const vector = DIRECTION_VECTORS[direction]
  let bestId: string | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const node of nodes) {
    if (node.id === current.id) continue
    const dx = node.x - current.x
    const dy = node.y - current.y
    const forward = dx * vector.x + dy * vector.y
    if (forward <= 0) continue
    const sideways = Math.abs(dx * vector.y - dy * vector.x)
    const score = forward + sideways * PERPENDICULAR_WEIGHT
    if (score < bestScore || (score === bestScore && bestId !== null && node.id < bestId)) {
      bestScore = score
      bestId = node.id
    }
  }

  return bestId
}
