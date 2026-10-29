import type { Entity, Claim } from '@/lib/studio/types'

/** Result of a merge operation including merged data and detected conflicts. */
export interface MergeResult<T> {
  merged: T
  conflicts: FieldConflict[]
}

/** Description of a single field-level conflict between local and remote values. */
export interface FieldConflict {
  entityId: string
  entityType: 'entity' | 'claim'
  field: string
  localValue: unknown
  remoteValue: unknown
  winner: 'local' | 'remote'
  reason: string
}

/** Stable conflict identity shared by the resolver, view, and resolution UI. */
export const getConflictResolutionKey = (
  conflict: Pick<FieldConflict, 'entityId' | 'entityType' | 'field'>,
): string => JSON.stringify([conflict.entityType, conflict.entityId, conflict.field])

const ISO_OFFSET_REGEX = /Z$|[+-]\d{2}:?\d{2}$/

/**
 * Parse an ISO-8601 timestamp string into epoch milliseconds for fast numeric comparison.
 * Zone-less timestamps are treated as UTC for deterministic comparison.
 */
const parseTimestampInstantMs = (value: string): number => {
  if (!value) return Number.NaN
  const normalized = ISO_OFFSET_REGEX.test(value) ? value : `${value}Z`
  return Date.parse(normalized)
}

/** Formats a timestamp into a canonical ISO string for human-readable conflict reporting. */
const timestampInstant = (value: string): string => {
  const ms = parseTimestampInstantMs(value)
  return Number.isNaN(ms) ? value : new Date(ms).toISOString()
}

/**
 * Deterministic timestamp ordering shared by merge and inbound conflict paths.
 * Compares parsed epoch milliseconds directly to avoid intermediate string/Date allocations.
 */
export function compareRecordTimestamps(a: string, b: string): number {
  const left = parseTimestampInstantMs(a)
  const right = parseTimestampInstantMs(b)
  if (!Number.isNaN(left) && !Number.isNaN(right)) {
    return left < right ? -1 : left > right ? 1 : 0
  }
  return a < b ? -1 : a > b ? 1 : 0
}

/** Pick the same timestamp representation when two raw strings denote one instant. */
function earlierTimestamp(a: string, b: string): string {
  const order = compareRecordTimestamps(a, b)
  return order < 0 ? a : order > 0 ? b : a <= b ? a : b
}

/** Pick the same latest timestamp representation when instants compare equally. */
function laterTimestamp(a: string, b: string): string {
  const order = compareRecordTimestamps(a, b)
  return order > 0 ? a : order < 0 ? b : a >= b ? a : b
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Merge two entity lists, resolving conflicts by timestamp and tracking field-level disagreements. */
export function mergeEntities(
  local: Entity[],
  remote: Entity[],
): MergeResult<Entity[]> {
  const conflicts: FieldConflict[] = []
  const mergedMap = new Map<string, Entity>()

  const localMap = new Map(local.map((e) => [e.id, e]))
  const remoteMap = new Map(remote.map((e) => [e.id, e]))

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  for (const id of allIds) {
    const localEntity = localMap.get(id)
    const remoteEntity = remoteMap.get(id)

    if (localEntity && !remoteEntity) {
      mergedMap.set(id, localEntity)
    } else if (!localEntity && remoteEntity) {
      mergedMap.set(id, remoteEntity)
    } else if (localEntity && remoteEntity) {
      const result = mergeSingleEntity(localEntity, remoteEntity)
      mergedMap.set(id, result.merged)
      conflicts.push(...result.conflicts)
    }
  }

  return { merged: Array.from(mergedMap.values()), conflicts }
}

function mergeSingleEntity(
  local: Entity,
  remote: Entity,
): MergeResult<Entity> {
  const conflicts: FieldConflict[] = []

  const merged: Entity = {
    id: local.id,
    name: mergeField(local.id, 'entity', 'name', local.name, remote.name, local.updatedAt, remote.updatedAt, conflicts),
    type: mergeField(local.id, 'entity', 'type', local.type, remote.type, local.updatedAt, remote.updatedAt, conflicts),
    description: mergeField(local.id, 'entity', 'description', local.description, remote.description, local.updatedAt, remote.updatedAt, conflicts),
    content: mergeField(local.id, 'entity', 'content', local.content, remote.content, local.updatedAt, remote.updatedAt, conflicts),
    sourceUrl: mergeField(local.id, 'entity', 'sourceUrl', local.sourceUrl, remote.sourceUrl, local.updatedAt, remote.updatedAt, conflicts),
    tags: mergeArrayField(local.id, 'entity', 'tags', local.tags, remote.tags, local.updatedAt, remote.updatedAt, conflicts),
    createdAt: earlierTimestamp(local.createdAt, remote.createdAt),
    updatedAt: laterTimestamp(local.updatedAt, remote.updatedAt),
    links: mergeLinks(local.id, local.links, remote.links, local.updatedAt, remote.updatedAt, conflicts),
  }

  return { merged, conflicts }
}

function mergeField<T>(
  entityId: string,
  entityType: 'entity' | 'claim',
  field: string,
  localValue: T,
  remoteValue: T,
  localTimestamp: string,
  remoteTimestamp: string,
  conflicts: FieldConflict[],
): T {
  if (localValue === remoteValue) return localValue
  if (localValue === undefined || localValue === null) return remoteValue
  if (remoteValue === undefined || remoteValue === null) return localValue

  if (compareRecordTimestamps(localTimestamp, remoteTimestamp) > 0) {
    conflicts.push({
      entityId,
      entityType,
      field,
      localValue,
      remoteValue,
      winner: 'local',
      reason: `local timestamp (${timestampInstant(localTimestamp)}) > remote (${timestampInstant(remoteTimestamp)})`,
    })
    return localValue
  }

  if (compareRecordTimestamps(remoteTimestamp, localTimestamp) > 0) {
    conflicts.push({
      entityId,
      entityType,
      field,
      localValue,
      remoteValue,
      winner: 'remote',
      reason: `remote timestamp (${timestampInstant(remoteTimestamp)}) > local (${timestampInstant(localTimestamp)})`,
    })
    return remoteValue
  }

  const winner =
    (JSON.stringify(localValue) ?? '') <= (JSON.stringify(remoteValue) ?? '')
      ? 'local'
      : 'remote'
  conflicts.push({
    entityId,
    entityType,
    field,
    localValue,
    remoteValue,
    winner,
    reason: 'timestamps equal, using stable value ordering',
  })
  return winner === 'local' ? localValue : remoteValue
}

function mergeArrayField<T>(
  entityId: string,
  entityType: 'entity' | 'claim',
  field: string,
  localArr: T[],
  remoteArr: T[],
  _localTimestamp: string,
  _remoteTimestamp: string,
  conflicts: FieldConflict[],
): T[] {
  if (arraysEqual(localArr, remoteArr)) return localArr

  const localSet = new Set(localArr.map((v) => JSON.stringify(v)))
  const remoteSet = new Set(remoteArr.map((v) => JSON.stringify(v)))

  const merged = new Set<T>()

  for (const item of localArr) {
    merged.add(item)
  }
  for (const item of remoteArr) {
    merged.add(item)
  }

  const localOnly = localArr.filter((v) => !remoteSet.has(JSON.stringify(v)))
  const remoteOnly = remoteArr.filter((v) => !localSet.has(JSON.stringify(v)))

  if (localOnly.length > 0 || remoteOnly.length > 0) {
    conflicts.push({
      entityId,
      entityType,
      field,
      localValue: localOnly,
      remoteValue: remoteOnly,
      winner: 'local',
      reason: `union of ${localOnly.length} local-only and ${remoteOnly.length} remote-only items`,
    })
  }

  return Array.from(merged)
}

function mergeLinks(
  entityId: string,
  localLinks: Entity['links'],
  remoteLinks: Entity['links'],
  localTimestamp: string,
  remoteTimestamp: string,
  conflicts: FieldConflict[],
): Entity['links'] {
  if (JSON.stringify(localLinks) === JSON.stringify(remoteLinks)) return localLinks

  const linkMap = new Map<string, Entity['links'][number]>()

  for (const link of localLinks) {
    linkMap.set(link.targetId, link)
  }
  for (const link of remoteLinks) {
    const existing = linkMap.get(link.targetId)
    if (!existing) {
      linkMap.set(link.targetId, link)
    } else if (existing.relation !== link.relation) {
      const order = compareRecordTimestamps(localTimestamp, remoteTimestamp)
      const winner =
        order > 0 ? existing :
        order < 0 ? link :
        existing.relation <= link.relation ? existing : link
      conflicts.push({
        entityId,
        entityType: 'entity',
        field: `links[${link.targetId}].relation`,
        localValue: existing.relation,
        remoteValue: link.relation,
        winner: winner === existing ? 'local' : 'remote',
        reason: `conflicting relation for target ${link.targetId}`,
      })
      linkMap.set(link.targetId, winner)
    }
  }

  return Array.from(linkMap.values())
}

/**
 * Merge two claim edit-history trails into a chronological, de-duplicated list.
 *
 * Each entry is keyed by its `editedAt` timestamp *and* statement so that two
 * distinct statements sharing the same edit timestamp (allowed by the schema)
 * are both preserved; the union is sorted oldest first so the provenance trail
 * is never lost or reordered by a sync round-trip.
 */
const mergeEditHistory = (local: Claim, remote: Claim): { statement: string; editedAt: string }[] => {
  const seen = new Set<string>()
  const merged: { statement: string; editedAt: string }[] = []
  for (const entry of [...(local.editHistory ?? []), ...(remote.editHistory ?? [])]) {
    // JSON-serialized pair is injective for arbitrary strings, unlike a plain
    // separator-based key which could collide when a value contains it.
    const key = JSON.stringify([entry.editedAt, entry.statement])
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(entry)
    }
  }
  return merged.sort((a, b) => {
    const timestampOrder = compareRecordTimestamps(a.editedAt, b.editedAt)
    if (timestampOrder !== 0) return timestampOrder
    return a.statement < b.statement ? -1 : a.statement > b.statement ? 1 : 0
  })
}

/** LWW comparator timestamp for a claim: updatedAt, falling back to createdAt. */
const claimTimestamp = (claim: Claim): string => claim.updatedAt ?? claim.createdAt ?? ''

/** Merge two claim lists, resolving conflicts by timestamp and tracking field-level disagreements. */
export function mergeClaims(
  local: Claim[],
  remote: Claim[],
): MergeResult<Claim[]> {
  const conflicts: FieldConflict[] = []
  const mergedMap = new Map<string, Claim>()

  const localMap = new Map(local.map((c) => [c.id, c]))
  const remoteMap = new Map(remote.map((c) => [c.id, c]))

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  for (const id of allIds) {
    const localClaim = localMap.get(id)
    const remoteClaim = remoteMap.get(id)

    if (localClaim && !remoteClaim) {
      mergedMap.set(id, localClaim)
    } else if (!localClaim && remoteClaim) {
      mergedMap.set(id, remoteClaim)
    } else if (localClaim && remoteClaim) {
      const result = mergeSingleClaim(localClaim, remoteClaim)
      mergedMap.set(id, result.merged)
      conflicts.push(...result.conflicts)
    }
  }

  return { merged: Array.from(mergedMap.values()), conflicts }
}

function mergeSingleClaim(
  local: Claim,
  remote: Claim,
): MergeResult<Claim> {
  const conflicts: FieldConflict[] = []
  const localTime = claimTimestamp(local)
  const remoteTime = claimTimestamp(remote)
  const mergedHistory = mergeEditHistory(local, remote)

  const merged: Claim = {
    id: local.id,
    entityId: mergeField(local.id, 'claim', 'entityId', local.entityId, remote.entityId, localTime, remoteTime, conflicts),
    statement: mergeField(local.id, 'claim', 'statement', local.statement, remote.statement, localTime, remoteTime, conflicts),
    evidence: mergeField(local.id, 'claim', 'evidence', local.evidence, remote.evidence, localTime, remoteTime, conflicts),
    confidence: mergeField(local.id, 'claim', 'confidence', local.confidence, remote.confidence, localTime, remoteTime, conflicts),
    verification: mergeField(local.id, 'claim', 'verification', local.verification, remote.verification, localTime, remoteTime, conflicts),
    source: mergeField(local.id, 'claim', 'source', local.source, remote.source, localTime, remoteTime, conflicts),
    // Provenance fields are preserved rather than dropped on merge: createdAt
    // keeps the earliest timestamp, updatedAt the latest, version is monotonic,
    // and editHistory is a chronological union of both trails.
    createdAt: local.createdAt && remote.createdAt
      ? earlierTimestamp(local.createdAt, remote.createdAt)
      : (local.createdAt ?? remote.createdAt),
    updatedAt: local.updatedAt && remote.updatedAt
      ? laterTimestamp(local.updatedAt, remote.updatedAt)
      : (local.updatedAt ?? remote.updatedAt),
    version: Math.max(local.version ?? 1, remote.version ?? 1),
    editHistory: mergedHistory.length > 0 ? mergedHistory : undefined,
  }

  return { merged, conflicts }
}
