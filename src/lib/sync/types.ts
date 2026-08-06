import * as Y from 'yjs'
import type { Entity, Claim } from '@/lib/studio/types'

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
  return data
}

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
  }
}
