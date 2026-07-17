import { getSyncDoc, getDoc } from './doc'
import {
  entityToYMap,
  ymapToEntity,
  claimToYMap,
  ymapToClaim,
} from './types'
import { mergeEntities, mergeClaims } from './merge'
import type { Entity, Claim } from '@/lib/studio/types'

type Unsubscribe = () => void

let unsubscribeFns: Unsubscribe[] = []

export function getYjsEntities(): Entity[] {
  const sync = getSyncDoc()
  const entities: Entity[] = []
  sync.entities.forEach((data) => {
    entities.push(ymapToEntity(data as Record<string, unknown>))
  })
  return entities
}

export function getYjsClaims(): Claim[] {
  const sync = getSyncDoc()
  const claims: Claim[] = []
  sync.claims.forEach((data) => {
    claims.push(ymapToClaim(data as Record<string, unknown>))
  })
  return claims
}

export function setYjsEntity(entity: Entity): void {
  const sync = getSyncDoc()
  sync.entities.set(entity.id, entityToYMap(entity))
}

export function removeYjsEntity(id: string): void {
  const sync = getSyncDoc()
  sync.entities.delete(id)
}

export function setYjsClaim(claim: Claim): void {
  const sync = getSyncDoc()
  sync.claims.set(claim.id, claimToYMap(claim))
}

export function removeYjsClaim(id: string): void {
  const sync = getSyncDoc()
  sync.claims.delete(id)
}

export function mergeIntoYjs(
  entities: Entity[],
  claims: Claim[],
): import('./merge').MergeResult<{ entities: Entity[]; claims: Claim[] }> {
  const sync = getSyncDoc()
  const doc = getDoc()

  const existingEntities = getYjsEntities()
  const existingClaims = getYjsClaims()

  const entityResult = mergeEntities(existingEntities, entities)
  const claimResult = mergeClaims(existingClaims, claims)

  doc.transact(() => {
    for (const entity of entityResult.merged) {
      sync.entities.set(entity.id, entityToYMap(entity))
    }
    for (const claim of claimResult.merged) {
      sync.claims.set(claim.id, claimToYMap(claim))
    }
  })

  return {
    merged: { entities: entityResult.merged, claims: claimResult.merged },
    conflicts: [...entityResult.conflicts, ...claimResult.conflicts],
  }
}

export function onYjsChange(
  callback: (entities: Entity[], claims: Claim[]) => void,
): Unsubscribe {
  const doc = getDoc()

  const handler = () => {
    callback(getYjsEntities(), getYjsClaims())
  }

  doc.on('update', handler)
  const unsub = () => doc.off('update', handler)
  unsubscribeFns.push(unsub)
  return unsub
}

export function subscribeToYjs(
  onEntitiesChange: (entities: Entity[]) => void,
  onClaimsChange: (claims: Claim[]) => void,
): Unsubscribe {
  const sync = getSyncDoc()

  const entityObserver = () => {
    onEntitiesChange(getYjsEntities())
  }

  const claimObserver = () => {
    onClaimsChange(getYjsClaims())
  }

  sync.entities.observe(entityObserver)
  sync.claims.observe(claimObserver)

  const unsub = () => {
    sync.entities.unobserve(entityObserver)
    sync.claims.unobserve(claimObserver)
  }
  unsubscribeFns.push(unsub)
  return unsub
}

export function destroyBridge(): void {
  for (const unsub of unsubscribeFns) unsub()
  unsubscribeFns = []
}

export async function initSync(): Promise<void> {
  const { initPersistence } = await import('./doc')
  await initPersistence()
}
