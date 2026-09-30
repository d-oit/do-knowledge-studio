/**
 * Pure corpus-merge helpers for cross-tab coordination (ADR 028).
 *
 * Extracted from `cross-tab.ts` to keep that module under the 500-LOC limit.
 * Nothing here touches storage, the channel, or the store: these are the
 * functions that decide what a peer's snapshot does to a local corpus, kept
 * separate so the transport layer stays about transport.
 */
import { mergeEntities, mergeClaims } from '@/lib/sync/merge'
import type { Claim, Entity } from './types'

/** Structural equality for persisted arrays (objects compare by serialized value). */
export const arraysEqual = (left: readonly unknown[], right: readonly unknown[]): boolean =>
  left.length === right.length && JSON.stringify(left) === JSON.stringify(right)

/** Structural inequality for a single optional persisted field.
 * `null` is the explicit "cleared" sentinel used by broadcasts; `undefined`
 * means the sender omitted the field (no update). */
export const jsonChanged = <T,>(local: T | undefined, remote: T | null | undefined): boolean => {
  if (remote === undefined) return false
  const localJson = local === undefined ? null : JSON.stringify(local)
  const remoteJson = remote === null ? null : JSON.stringify(remote)
  return localJson !== remoteJson
}

/** Ids of items present in `previous` but absent in `next` (the local deletions). */
export const removedIds = <T extends { id: string }>(
  previous: readonly T[],
  next: readonly T[],
): string[] => {
  const nextIds = new Set(next.map((item) => item.id))
  const removed: string[] = []
  for (const item of previous) {
    if (!nextIds.has(item.id)) {
      removed.push(item.id)
    }
  }
  return removed
}

/** Whether an item was last written after the given delete-broadcast time. */
const updatedAfter = (item: { updatedAt?: string; createdAt?: string }, timestamp: number): boolean => {
  const lastWrite = item.updatedAt ?? item.createdAt
  if (!lastWrite) return false
  const parsed = Date.parse(lastWrite)
  return !Number.isNaN(parsed) && parsed > timestamp
}

/** Drops items a deletion map says were removed, unless re-created after the tombstone. */
const withoutRemoteDeletes = <T extends { id: string; updatedAt?: string; createdAt?: string }>(
  items: readonly T[],
  deletedById: ReadonlyMap<string, number>,
): T[] => {
  if (deletedById.size === 0) {
    return [...items]
  }
  return items.filter((item) => {
    const deletedAt = deletedById.get(item.id)
    return deletedAt === undefined || updatedAfter(item, deletedAt)
  })
}

/** Outcome of a corpus merge: merged lists plus per-list change flags. */
export interface CorpusMerge {
  entities: Entity[]
  claims: Claim[]
  entitiesChanged: boolean
  claimsChanged: boolean
}

/** Field-level merge of the remote corpus against local state, deletions applied. */
export const mergeCorpus = (
  currentEntities: readonly Entity[],
  currentClaims: readonly Claim[],
  remoteEntities: readonly Entity[],
  remoteClaims: readonly Claim[],
  deletedEntities: ReadonlyMap<string, number>,
  deletedClaims: ReadonlyMap<string, number>,
): CorpusMerge => {
  // Deletions apply to both sides: local items the maps tombstone are dropped,
  // and remote items from a stale snapshot that were already deleted (unless
  // re-created after the tombstone) must not re-enter through the merge union.
  const localEntities = withoutRemoteDeletes(currentEntities, deletedEntities)
  const localClaims = withoutRemoteDeletes(currentClaims, deletedClaims)
  const remoteSurvivors = withoutRemoteDeletes(remoteEntities, deletedEntities)
  const remoteClaimSurvivors = withoutRemoteDeletes(remoteClaims, deletedClaims)
  const mergedEntities = mergeEntities([...localEntities], [...remoteSurvivors]).merged
  const mergedClaims = mergeClaims([...localClaims], [...remoteClaimSurvivors]).merged

  const deletedEntitySet = new Set(deletedEntities.keys())
  const survivingEntityIds = new Set(mergedEntities.map((entity) => entity.id))
  // Preserve the no-dangling-claims invariant that deleteEntity enforces
  // locally (ADR 028): a claim whose entity was removed by the same remote
  // deletion — and is absent from both merge sides — cannot survive, or the
  // receiving tab ends up with an entityId that no longer exists anywhere.
  const survivingClaims = mergedClaims.filter(
    (claim) => !deletedEntitySet.has(claim.entityId) || survivingEntityIds.has(claim.entityId),
  )
  // Local deleteEntity also strips links that target the removed entity from
  // every surviving entity; mirror that so remote deletions cannot leave a
  // link pointing at a now-gone entity.
  const goneEntityIds = new Set([...deletedEntitySet].filter((id) => !survivingEntityIds.has(id)))
  const entitiesWithCleanLinks = mergedEntities.map((entity) => {
    const keptLinks = entity.links.filter((link) => !goneEntityIds.has(link.targetId))
    return keptLinks.length === entity.links.length ? entity : { ...entity, links: keptLinks }
  })
  return {
    entities: entitiesWithCleanLinks,
    claims: survivingClaims,
    entitiesChanged: !arraysEqual(currentEntities, entitiesWithCleanLinks),
    claimsChanged: !arraysEqual(currentClaims, survivingClaims),
  }
}
