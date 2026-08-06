import { z } from 'zod'
import * as Y from 'yjs'
import { getSyncDoc } from './doc'

/** Zod schema for a tombstone record marking a deleted entity. */
export const TombstoneSchema = z.object({
  id: z.string().min(1),
  deletedAt: z.string(),
  deletedBy: z.string().optional(),
})

/** Type inferred from the Tombstone schema. */
export type Tombstone = z.infer<typeof TombstoneSchema>

/** Yjs map key storing tombstone records. */
const TOMBSTONES_KEY = 'tombstones'

/** Get or create the tombstones Yjs map within the sync document metadata. */
export function getTombstoneMap(): Y.Map<Record<string, unknown>> {
  const sync = getSyncDoc()
  let map = sync.meta.get(TOMBSTONES_KEY) as Y.Map<Record<string, unknown>> | undefined
  if (!map) {
    map = new Y.Map()
    sync.meta.set(TOMBSTONES_KEY, map)
  }
  return map
}

/** Record a tombstone for a deleted entity ID. */
export function addTombstone(id: string, deletedBy?: string): void {
  const map = getTombstoneMap()
  map.set(id, {
    id,
    deletedAt: new Date().toISOString(),
    deletedBy: deletedBy ?? 'local',
  })
}

/** Check whether an entity ID has been tombstoned (deleted). */
export function isTombstoned(id: string): boolean {
  const map = getTombstoneMap()
  return map.has(id)
}

/** Retrieve a single validated tombstone record by entity ID. */
export function getTombstone(id: string): Tombstone | null {
  const map = getTombstoneMap()
  const data = map.get(id)
  if (!data) return null
  const result = TombstoneSchema.safeParse(data)
  return result.success ? result.data : null
}

/** Return all validated tombstone records. */
export function getAllTombstones(): Tombstone[] {
  const map = getTombstoneMap()
  const tombstones: Tombstone[] = []
  map.forEach((data) => {
    const result = TombstoneSchema.safeParse(data)
    if (result.success) tombstones.push(result.data)
  })
  return tombstones
}

/** Clear all tombstone records from the sync document. */
export function clearTombstones(): void {
  const map = getTombstoneMap()
  map.clear()
}
