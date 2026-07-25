import { z } from 'zod'
import * as Y from 'yjs'
import { getSyncDoc } from './doc'

export const TombstoneSchema = z.object({
  id: z.string().min(1),
  deletedAt: z.string(),
  deletedBy: z.string().optional(),
})

export type Tombstone = z.infer<typeof TombstoneSchema>

const TOMBSTONES_KEY = 'tombstones'

export function getTombstoneMap(): Y.Map<Record<string, unknown>> {
  const sync = getSyncDoc()
  let map = sync.meta.get(TOMBSTONES_KEY) as Y.Map<Record<string, unknown>> | undefined
  if (!map) {
    map = new Y.Map()
    sync.meta.set(TOMBSTONES_KEY, map)
  }
  return map
}

export function addTombstone(id: string, deletedBy?: string): void {
  const map = getTombstoneMap()
  map.set(id, {
    id,
    deletedAt: new Date().toISOString(),
    deletedBy: deletedBy ?? 'local',
  })
}

export function isTombstoned(id: string): boolean {
  const map = getTombstoneMap()
  return map.has(id)
}

export function getTombstone(id: string): Tombstone | null {
  const map = getTombstoneMap()
  const data = map.get(id)
  if (!data) return null
  const result = TombstoneSchema.safeParse(data)
  return result.success ? result.data : null
}

export function getAllTombstones(): Tombstone[] {
  const map = getTombstoneMap()
  const tombstones: Tombstone[] = []
  map.forEach((data) => {
    const result = TombstoneSchema.safeParse(data)
    if (result.success) tombstones.push(result.data)
  })
  return tombstones
}

export function clearTombstones(): void {
  const map = getTombstoneMap()
  map.clear()
}
