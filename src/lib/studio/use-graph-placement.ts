'use client'

/**
 * Progressive graph placement (#1053).
 *
 * Placing a 5k-node library in one synchronous pass blocks the main thread for
 * hundreds of milliseconds. Above `SYNC_PLACEMENT_NODE_LIMIT` the placement is
 * split into chunks, one per animation frame, so the canvas paints immediately
 * with the seed nodes and grows toward the full graph instead of freezing.
 * Small corpora keep the single-pass path — chunking them would only add frames.
 *
 * Placement is keyed by CONTENT, not by array identity: a caller that rebuilds
 * its entity array on every render (a filtered copy, a store selector, a test
 * fixture) must not restart placement, because re-running the placement effect
 * there would set state on every commit and loop. The signature below changes
 * only when a placed node's id, label, or type does, or when the measured
 * viewport resizes.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Entity, GraphNode } from './types'
import { createPlacementRunner, type ViewportSize } from './graph-layout'

/** Corpora at or below this size place synchronously. */
export const SYNC_PLACEMENT_NODE_LIMIT = 500

/** Separates the fields of one entity so distinct nodes cannot collide. */
const FIELD_SEPARATOR = '\u0000'

/** Separates entities from the viewport part of a signature. */
const SECTION_SEPARATOR = '\u0001'

/** Placement inputs, as last committed to the DOM. */
interface PlacementInputs {
  entities: readonly Entity[]
  seedNodes: readonly GraphNode[]
  viewport: ViewportSize | null
}

/** Placed nodes plus the signature they were placed from. */
interface PlacementState {
  signature: string
  nodes: GraphNode[]
}

/**
 * Content signature for one placement input set. Covers everything placement
 * reads from an entity: its id (determines order and probe seed), label, and
 * type. The viewport only reshapes the band, so it appears as a size pair.
 */
const buildSignature = (
  entities: readonly Entity[],
  seedNodes: readonly GraphNode[],
  viewport: ViewportSize | null,
): string => {
  const parts = entities.map((entity) =>
    [entity.id, entity.name, entity.type].join(FIELD_SEPARATOR),
  )
  return [
    String(seedNodes.length),
    viewport ? `${viewport.width}x${viewport.height}` : 'unmeasured',
    parts.join(SECTION_SEPARATOR),
  ].join(SECTION_SEPARATOR)
}

/** One synchronous placement pass. */
const placeAll = (inputs: PlacementInputs): GraphNode[] =>
  createPlacementRunner(inputs.entities, inputs.seedNodes, inputs.viewport).placeChunk(true)

/**
 * Places `entities` progressively and returns the nodes resolved so far.
 * @param entities - Corpus to place (filtered graph).
 * @param seedNodes - Authored seed positions.
 * @param viewport - Measured viewport, or null before it is known.
 * @returns Positioned nodes; a prefix of the corpus while placement runs.
 */
export const useGraphPlacement = (
  entities: readonly Entity[],
  seedNodes: readonly GraphNode[],
  viewport: ViewportSize | null,
): GraphNode[] => {
  const signature = useMemo(
    () => buildSignature(entities, seedNodes, viewport),
    [entities, seedNodes, viewport],
  )
  const isSync = entities.length <= SYNC_PLACEMENT_NODE_LIMIT

  // Committed inputs for the effect, which re-runs on signature changes only.
  const latest = useRef<PlacementInputs>({ entities, seedNodes, viewport })
  useEffect(() => {
    latest.current = { entities, seedNodes, viewport }
  }, [entities, seedNodes, viewport])

  const [placement, setPlacement] = useState<PlacementState>(() => ({
    signature,
    nodes: isSync ? placeAll({ entities, seedNodes, viewport }) : [],
  }))

  useEffect(() => {
    const inputs = latest.current
    const runner = createPlacementRunner(inputs.entities, inputs.seedNodes, inputs.viewport)
    if (inputs.entities.length <= SYNC_PLACEMENT_NODE_LIMIT) {
      const nodes = runner.placeChunk(true)
      // The mount state already holds this signature's placement.
      setPlacement((previous) =>
        previous.signature === signature ? previous : { signature, nodes },
      )
      return undefined
    }
    let cancelled = false
    let frame = 0
    const step = (): void => {
      if (cancelled) return
      setPlacement({ signature, nodes: runner.placeChunk() })
      if (!runner.done) frame = requestAnimationFrame(step)
    }
    setPlacement({ signature, nodes: runner.placeChunk() })
    frame = requestAnimationFrame(step)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [isSync, signature])

  return placement.nodes
}
