import * as Y from 'yjs'
import type { Entity, Claim } from '@/lib/studio/types'

/** Explicit lifecycle states for the peer-to-peer sync engine and UI. */
export type SyncLifecycleState =
  | 'idle'
  | 'persistence-loading'
  | 'joining'
  | 'room-active'
  | 'peer-connected'
  | 'syncing'
  | 'conflict'
  | 'error'
  | 'leaving'

/** Metadata about a synced device. */
export interface SyncMeta {
  deviceId: string
  deviceName: string
  lastSeen: number
}

/** Typed view over a Yjs document holding entities, claims, and metadata maps. */
export interface SyncDoc {
  entities: Y.Map<Record<string, unknown>>
  claims: Y.Map<Record<string, unknown>>
  meta: Y.Map<unknown>
}

/** Create an empty SyncDoc with fresh Yjs maps. */
export function createSyncDoc(): SyncDoc {
  return {
    entities: new Y.Map(),
    claims: new Y.Map(),
    meta: new Y.Map(),
  }
}

/** Convert an Entity to a plain object suitable for Yjs map storage. */
export function entityToYMap(entity: Entity): Record<string, unknown> {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    content: entity.content,
    sourceUrl: entity.sourceUrl,
    tags: entity.tags,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    links: entity.links,
  }
}

/** Deserialize a plain object from a Yjs map back into an Entity. */
export function ymapToEntity(data: Record<string, unknown>): Entity {
  return {
    id: data.id as string,
    name: data.name as string,
    type: data.type as Entity['type'],
    description: data.description as string,
    content: data.content as string,
    sourceUrl: data.sourceUrl as string | undefined,
    tags: (data.tags as string[]) ?? [],
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
    links: ((data.links as { targetId: string; relation: string }[]) ?? []),
  }
}

/** Convert a Claim to a plain object suitable for Yjs map storage. */
export function claimToYMap(claim: Claim): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: claim.id,
    entityId: claim.entityId,
    statement: claim.statement,
    confidence: claim.confidence,
    verification: claim.verification,
  }
  if (claim.evidence !== undefined) data.evidence = claim.evidence
  if (claim.source !== undefined) data.source = claim.source
  if (claim.createdAt !== undefined) data.createdAt = claim.createdAt
  if (claim.updatedAt !== undefined) data.updatedAt = claim.updatedAt
  // Provenance must survive the sync round-trip — otherwise LWW degrades and
  // versioning restarts after a single merge (ADR 027 §2).
  if (claim.version !== undefined) data.version = claim.version
  if (claim.editHistory !== undefined) data.editHistory = claim.editHistory
  return data
}

const arraysEqual = <T>(
  left: readonly T[],
  right: readonly T[],
  areEqual: (leftValue: T, rightValue: T) => boolean,
): boolean => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]
    const rightValue = right[index]
    if (leftValue === undefined || rightValue === undefined || !areEqual(leftValue, rightValue)) {
      return false
    }
  }
  return true
}

const sameString = (left: string, right: string): boolean => left === right

const sameEntityLink = (
  left: Entity['links'][number],
  right: Entity['links'][number],
): boolean => left.targetId === right.targetId && left.relation === right.relation

const sameClaimHistoryEntry = (
  left: NonNullable<Claim['editHistory']>[number],
  right: NonNullable<Claim['editHistory']>[number],
): boolean => left.statement === right.statement && left.editedAt === right.editedAt

const sameClaimHistory = (left: Claim['editHistory'], right: Claim['editHistory']): boolean => {
  const leftLength = left?.length ?? 0
  const rightLength = right?.length ?? 0
  if (leftLength !== rightLength) return false
  if (leftLength === 0) return true
  if (!left || !right) return false
  return arraysEqual(left, right, sameClaimHistoryEntry)
}

/** Compare the application fields serialized by `entityToYMap`, excluding sync metadata. */
export const sameEntityPayload = (left: Entity, right: Entity): boolean =>
  left.id === right.id &&
  left.name === right.name &&
  left.type === right.type &&
  left.description === right.description &&
  left.content === right.content &&
  left.sourceUrl === right.sourceUrl &&
  left.createdAt === right.createdAt &&
  left.updatedAt === right.updatedAt &&
  arraysEqual(left.tags, right.tags, sameString) &&
  arraysEqual(left.links, right.links, sameEntityLink)

/** Compare claim payloads, treating missing and empty edit histories as equivalent. */
export const sameClaimPayload = (left: Claim, right: Claim): boolean =>
  left.id === right.id &&
  left.entityId === right.entityId &&
  left.statement === right.statement &&
  left.evidence === right.evidence &&
  left.confidence === right.confidence &&
  left.verification === right.verification &&
  left.source === right.source &&
  left.createdAt === right.createdAt &&
  left.updatedAt === right.updatedAt &&
  left.version === right.version &&
  sameClaimHistory(left.editHistory, right.editHistory)

/** Deserialize a plain object from a Yjs map back into a Claim. */
export function ymapToClaim(data: Record<string, unknown>): Claim {
  return {
    id: data.id as string,
    entityId: data.entityId as string,
    statement: data.statement as string,
    evidence: data.evidence as string | undefined,
    confidence: data.confidence as number,
    verification: data.verification as Claim['verification'],
    source: data.source as string | undefined,
    createdAt: data.createdAt as string | undefined,
    updatedAt: data.updatedAt as string | undefined,
    version: data.version as number | undefined,
    editHistory: data.editHistory as Claim['editHistory'],
  }
}
