import type { Claim, Entity } from '@/lib/studio/types'
import { getDoc, getSyncDoc } from './doc'
import { sameClaimPayload, sameEntityPayload, claimToYMap, entityToYMap } from './types'
import { getTombstone } from './tombstones'
import { setVersionedRecord } from './causality'

/** Origin tag for canonical-to-Yjs transactions that must not echo back into the bridge. */
export const ORIGIN_OUTBOUND = 'zustand-outbound'

/** Write deterministic merged records back to Yjs, except unresolved delete conflicts. */
export const reconcileMergedRecords = (
  merged: { entities: Entity[]; claims: Claim[] },
  current: { entities: Entity[]; claims: Claim[] },
  excluded: { entities: ReadonlySet<string>; claims: ReadonlySet<string> },
): void => {
  const currentEntitiesById = new Map<string, Entity>()
  for (const entity of current.entities) currentEntitiesById.set(entity.id, entity)
  const currentClaimsById = new Map<string, Claim>()
  for (const claim of current.claims) currentClaimsById.set(claim.id, claim)
  const sync = getSyncDoc()
  getDoc().transact(() => {
    for (const entity of merged.entities) {
      if (excluded.entities.has(entity.id)) continue
      const existing = currentEntitiesById.get(entity.id)
      if (existing && sameEntityPayload(existing, entity)) continue
      setVersionedRecord(sync.entities, 'entities', entity.id, entityToYMap(entity), getTombstone(entity.id)?.clock)
    }
    for (const claim of merged.claims) {
      if (excluded.claims.has(claim.id)) continue
      const existing = currentClaimsById.get(claim.id)
      if (existing && sameClaimPayload(existing, claim)) continue
      setVersionedRecord(sync.claims, 'claims', claim.id, claimToYMap(claim), getTombstone(claim.id, 'claims')?.clock)
    }
  }, ORIGIN_OUTBOUND)
}
