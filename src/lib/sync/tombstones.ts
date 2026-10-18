import { z } from 'zod'
import * as Y from 'yjs'
import { compareClocks, nextRecordClock, readRecordClock, type CausalClock, type RecordKind } from './causality'
import { getDeviceId } from './discovery'
import { getCurrentRoomId, getSyncDoc } from './doc'

/** Tombstones are permanent: no automatic compaction is safe without peer acknowledgements. */
const CAUSAL_CLOCK_SCHEMA = z.record(
  z.string().min(1),
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
)

/** Zod schema for a room-scoped, causally ordered tombstone record. */
export const TombstoneSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  deletedAt: z.string().min(1),
  deletedBy: z.string().min(1),
  kind: z.enum(['entities', 'claims']).optional(),
  clock: CAUSAL_CLOCK_SCHEMA.optional(),
})

/** Type inferred from the Tombstone schema. */
export type Tombstone = z.infer<typeof TombstoneSchema>

/** Yjs map key storing tombstone records, persisted in the IndexedDB-backed doc. */
const TOMBSTONES_KEY = 'tombstones'

const tombstoneKey = (roomId: string, id: string, kind: RecordKind): string =>
  JSON.stringify([roomId, kind, id])

const findTombstoneMap = (): Y.Map<Record<string, unknown>> | null => {
  const value = getSyncDoc().meta.get(TOMBSTONES_KEY)
  return value instanceof Y.Map ? value as Y.Map<Record<string, unknown>> : null
}
/**
 * Read matching tombstones across all known rooms only when no room identity
 * is available (for example, during IndexedDB restore before a room is joined).
 * Room-scoped lookups remain isolated once a session selects its room.
 */
const getMatchingTombstones = (
  id: string,
  kind: RecordKind,
  roomId: string | null,
): Tombstone[] => {
  const map = findTombstoneMap()
  if (!map) return []
  const matches: Tombstone[] = []
  map.forEach((data) => {
    const result = TombstoneSchema.safeParse(data)
    if (!result.success) return
    const tombstone = result.data
    if (tombstone.id !== id ||
        (roomId !== null && tombstone.roomId !== roomId) ||
        (tombstone.kind && tombstone.kind !== kind)) return
    matches.push(tombstone)
  })
  return matches
}

/** Get or create the tombstones Yjs map within the sync document metadata. */
export function getTombstoneMap(): Y.Map<Record<string, unknown>> {
  const existing = findTombstoneMap()
  if (existing) return existing
  const map = new Y.Map<Record<string, unknown>>()
  getSyncDoc().meta.set(TOMBSTONES_KEY, map)
  return map
}

/** Record a tombstone for a deleted record in its active room. */
export function addTombstone(
  id: string,
  deletedBy?: string,
  kind: RecordKind = 'entities',
): void {
  const roomId = getCurrentRoomId() ?? 'local'
  const deviceId = deletedBy ?? getDeviceId()
  const existing = getTombstone(id, kind)
  const clock = nextRecordClock(
    [readRecordClock(kind, id), existing?.clock ?? {}],
    deviceId,
  )
  getTombstoneMap().set(tombstoneKey(roomId, id, kind), {
    id,
    roomId,
    kind,
    deletedAt: new Date().toISOString(),
    deletedBy: deviceId,
    clock,
  })
}

/** Check whether an ID has been tombstoned in the active room. */
export function isTombstoned(id: string, kind: RecordKind = 'entities', recordClock?: CausalClock): boolean {
  const roomId = getCurrentRoomId()
  const tombstones = roomId === null
    ? getMatchingTombstones(id, kind, null)
    : [getTombstone(id, kind)].filter((tombstone): tombstone is Tombstone => tombstone !== null)
  return tombstones.some((tombstone) =>
    !tombstone.clock || compareClocks(tombstone.clock, recordClock ?? {}) === 1,
  )
}

/** Retrieve a single validated active-room tombstone by record ID. */
export function getTombstone(id: string, kind: RecordKind = 'entities'): Tombstone | null {
  const roomId = getCurrentRoomId()
  if (roomId === null) return getMatchingTombstones(id, kind, null)[0] ?? null
  const map = findTombstoneMap()
  if (!map) return null
  const data = map.get(tombstoneKey(roomId, id, kind)) ?? map.get(JSON.stringify([roomId, id]))
  if (!data) return null
  const result = TombstoneSchema.safeParse(data)
  return result.success && result.data.roomId === roomId &&
    result.data.id === id && (!result.data.kind || result.data.kind === kind) ? result.data : null
}

/** Return all validated tombstones for the active room. */
export function getAllTombstones(): Tombstone[] {
  const roomId = getCurrentRoomId()
  const map = findTombstoneMap()
  if (!map) return []
  const tombstones: Tombstone[] = []
  map.forEach((data) => {
    const result = TombstoneSchema.safeParse(data)
    if (result.success && (roomId === null || result.data.roomId === roomId)) {
      tombstones.push(result.data)
    }
  })
  return tombstones
}


/** Destructive room-scoped override; unsafe while any offline peer may rejoin. */
export function clearTombstones(): void {
  const roomId = getCurrentRoomId() ?? 'local'
  const map = getTombstoneMap()
  map.forEach((data, key) => {
    const result = TombstoneSchema.safeParse(data)
    if (result.success && result.data.roomId === roomId) map.delete(key)
  })
}

