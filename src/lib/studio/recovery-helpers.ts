import { z } from 'zod'
import type { Entity, Claim } from './types'
import {
  EntitySchema,
  ClaimSchema,
  GraphSchema,
  MindMapSchema,
  LinkSchema,
  TagSchema,
} from './schema'
import type { ValidatedGraph, ValidatedMindMap, ValidatedLink, ValidatedTag } from './schema'
import { useStudioStore } from './store'

const RECOVERY_KEY = 'do-knowledge-studio-recovery'
const RECOVERY_TTL_MS = 24 * 60 * 60 * 1000
const MAX_RECOVERY_SIZE_BYTES = 4 * 1024 * 1024

export interface RecoverySnapshot {
  entities: Entity[]
  claims: Claim[]
  entityHistory: Entity[][]
  historyIndex: number
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
}

/** Creates a deep-cloned recovery snapshot from the current store state. */
export const buildRecoverySnapshot = (state: {
  entities: Entity[]
  claims: Claim[]
  entityHistory: Entity[][]
  historyIndex: number
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
}): RecoverySnapshot => ({
  entities: structuredClone(state.entities),
  claims: structuredClone(state.claims),
  entityHistory: structuredClone(state.entityHistory),
  historyIndex: state.historyIndex,
  graph: state.graph ? structuredClone(state.graph) : undefined,
  mindMap: state.mindMap ? structuredClone(state.mindMap) : undefined,
  links: state.links ? structuredClone(state.links) : undefined,
  tags: state.tags ? structuredClone(state.tags) : undefined,
})

/** Persists a recovery snapshot to localStorage with size and TTL guards. */
export const persistRecoverySnapshot = (snapshot: RecoverySnapshot): void => {
  try {
    const serialized = JSON.stringify({ snapshot, timestamp: Date.now(), ttl: RECOVERY_TTL_MS })
    if (serialized.length > MAX_RECOVERY_SIZE_BYTES) {
      console.warn('Recovery snapshot exceeds size limit, skipping persistence')
    } else {
      localStorage.setItem(RECOVERY_KEY, serialized)
    }
  } catch {
    console.warn('Failed to persist recovery snapshot')
  }
}

const RecoverySnapshotSchema = z.object({
  snapshot: z.object({
    entities: z.array(EntitySchema),
    claims: z.array(ClaimSchema),
    entityHistory: z.array(z.array(z.object({ id: z.string() }))),
    historyIndex: z.number(),
    graph: GraphSchema.optional(),
    mindMap: MindMapSchema.optional(),
    links: z.array(LinkSchema).optional(),
    tags: z.array(TagSchema).optional(),
  }),
  timestamp: z.number(),
  ttl: z.number().optional(),
})

type RecoveryReadResult =
  | { ok: true; data: z.infer<typeof RecoverySnapshotSchema> }
  | { ok: false; error: string }

const clearRecoverySnapshot = (): void => {
  try {
    localStorage.removeItem(RECOVERY_KEY)
  } catch {
    console.warn('Failed to clear corrupt recovery snapshot')
  }
}

/** Reads and validates the recovery snapshot from localStorage, returning it if valid. */
export const readRecoverySnapshot = (): RecoveryReadResult => {
  const raw = localStorage.getItem(RECOVERY_KEY)
  if (!raw) return { ok: false, error: 'No recovery snapshot found.' }

  const parsed: unknown = JSON.parse(raw)
  const result = RecoverySnapshotSchema.safeParse(parsed)
  if (!result.success) {
    clearRecoverySnapshot()
    return { ok: false, error: 'Recovery snapshot is corrupted.' }
  }

  const { timestamp, ttl } = result.data
  if (Date.now() - timestamp > (ttl ?? RECOVERY_TTL_MS)) {
    clearRecoverySnapshot()
    return { ok: false, error: 'Recovery snapshot has expired.' }
  }
  return { ok: true, data: result.data }
}

type ValidatedRecoverySnapshot = z.infer<typeof RecoverySnapshotSchema>['snapshot']

const applyRecoverySnapshot = (snapshot: ValidatedRecoverySnapshot): void => {
  useStudioStore.setState({
    entities: snapshot.entities as Entity[],
    claims: snapshot.claims as Claim[],
    entityHistory: snapshot.entityHistory as Entity[][],
    historyIndex: snapshot.historyIndex,
    graph: snapshot.graph as ValidatedGraph | undefined,
    mindMap: snapshot.mindMap as ValidatedMindMap | undefined,
    links: snapshot.links as ValidatedLink[] | undefined,
    tags: snapshot.tags as ValidatedTag[] | undefined,
  })
}

/** Restores store state from the recovery snapshot and clears it afterward. */
export const restoreFromRecovery = (): { success: boolean; error?: string } => {
  try {
    const result = readRecoverySnapshot()
    if (!result.ok) return { success: false, error: result.error }
    applyRecoverySnapshot(result.data.snapshot)
    clearRecoverySnapshot()
    return { success: true }
  } catch (err) {
    // A readable but corrupt snapshot (e.g., unparseable JSON) would otherwise
    // linger forever — clear it so the next restore attempt starts fresh.
    clearRecoverySnapshot()
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to restore recovery snapshot.',
    }
  }
}
