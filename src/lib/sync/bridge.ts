import * as Y from 'yjs'
import { getSyncDoc, getDoc } from './doc'
import {
  entityToYMap,
  ymapToEntity,
  claimToYMap,
  ymapToClaim,
} from './types'
import { mergeEntities, mergeClaims } from './merge'
import { isTombstoned, addTombstone } from './tombstones'
import { validateInboundEntity, validateInboundClaim } from './inbound'
import { resolveEntityConflict, resolveClaimConflict } from './conflict'
import type { Entity, Claim } from '@/lib/studio/types'
import { useStudioStore } from '@/lib/studio/store'

type Unsubscribe = () => void

const ORIGIN_OUTBOUND = 'zustand-outbound'

let unsubscribeFns: Unsubscribe[] = []
let inboundCallbacks: {
  onEntities?: (entities: Entity[]) => void
  onClaims?: (claims: Claim[]) => void
} = {}
let outboundSubscribed = false

export function getYjsEntities(): Entity[] {
  const sync = getSyncDoc()
  const entities: Entity[] = []
  sync.entities.forEach((data) => {
    const entity = ymapToEntity(data as Record<string, unknown>)
    if (!isTombstoned(entity.id)) {
      entities.push(entity)
    }
  })
  return entities
}

export function getYjsClaims(): Claim[] {
  const sync = getSyncDoc()
  const claims: Claim[] = []
  sync.claims.forEach((data) => {
    const claim = ymapToClaim(data as Record<string, unknown>)
    if (!isTombstoned(claim.id)) {
      claims.push(claim)
    }
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
  addTombstone(id)
}

export function setYjsClaim(claim: Claim): void {
  const sync = getSyncDoc()
  sync.claims.set(claim.id, claimToYMap(claim))
}

export function removeYjsClaim(id: string): void {
  const sync = getSyncDoc()
  sync.claims.delete(id)
  addTombstone(id)
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
  }, ORIGIN_OUTBOUND)

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
  let active = true
  const unsub = () => {
    if (!active) return
    active = false
    doc.off('update', handler)
  }
  unsubscribeFns.push(unsub)
  return unsub
}

export function subscribeToYjs(
  onEntitiesChange: (entities: Entity[]) => void,
  onClaimsChange: (claims: Claim[]) => void,
): Unsubscribe {
  const sync = getSyncDoc()

  inboundCallbacks.onEntities = onEntitiesChange
  inboundCallbacks.onClaims = onClaimsChange

  const entityObserver = (event: Y.YMapEvent<Record<string, unknown>>) => {
    if (event.transaction.origin === ORIGIN_OUTBOUND) return
    const entities = getYjsEntities()
    onEntitiesChange(entities)
  }

  const claimObserver = (event: Y.YMapEvent<Record<string, unknown>>) => {
    if (event.transaction.origin === ORIGIN_OUTBOUND) return
    const claims = getYjsClaims()
    onClaimsChange(claims)
  }

  sync.entities.observe(entityObserver)
  sync.claims.observe(claimObserver)

  let active = true
  const unsub = () => {
    if (!active) return
    active = false
    sync.entities.unobserve(entityObserver)
    sync.claims.unobserve(claimObserver)
    inboundCallbacks = {}
  }
  unsubscribeFns.push(unsub)
  return unsub
}

export function applyRemoteUpdate(
  remoteEntities: Entity[],
  remoteClaims: Claim[],
  localEntities: Entity[],
  localClaims: Claim[],
): { entities: Entity[]; claims: Claim[] } {
  const validEntities = remoteEntities.filter((e) => {
    const result = validateInboundEntity(e)
    return result.success
  })
  const validClaims = remoteClaims.filter((c) => {
    const result = validateInboundClaim(c)
    return result.success
  })

  const entityMap = new Map(localEntities.map((e) => [e.id, e]))
  for (const remote of validEntities) {
    const local = entityMap.get(remote.id)
    if (!local || !isTombstoned(remote.id)) {
      entityMap.set(remote.id, local ? resolveEntityConflict(local, remote) : remote)
    }
  }

  const claimMap = new Map(localClaims.map((c) => [c.id, c]))
  for (const remote of validClaims) {
    const local = claimMap.get(remote.id)
    if (!local || !isTombstoned(remote.id)) {
      claimMap.set(remote.id, local ? resolveClaimConflict(local, remote) : remote)
    }
  }

  return {
    entities: Array.from(entityMap.values()),
    claims: Array.from(claimMap.values()),
  }
}

export function destroyBridge(): void {
  for (const unsub of unsubscribeFns) unsub()
  unsubscribeFns = []
  inboundCallbacks = {}
  outboundSubscribed = false
}

export async function initSync(): Promise<void> {
  const { initPersistence } = await import('./doc')
  await initPersistence()
}

export function applyConflictResolution(
  resolutions: Map<string, 'local' | 'remote'>,
  conflicts: import('./merge').FieldConflict[],
  localEntities: Entity[],
  localClaims: Claim[],
): void {
  const sync = getSyncDoc()
  const doc = getDoc()

  const entityUpdates = collectUpdates<Entity>(
    conflicts.filter((c) => c.entityType === 'entity'),
    resolutions,
    localEntities,
  )
  const claimUpdates = collectUpdates<Claim>(
    conflicts.filter((c) => c.entityType === 'claim'),
    resolutions,
    localClaims,
  )

  doc.transact(() => {
    for (const [id, updates] of entityUpdates) {
      const local = localEntities.find((e) => e.id === id)
      if (local) {
        sync.entities.set(id, entityToYMap({ ...local, ...updates, updatedAt: new Date().toISOString() }))
      }
    }
    for (const [id, updates] of claimUpdates) {
      const local = localClaims.find((c) => c.id === id)
      if (local) {
        sync.claims.set(id, claimToYMap({ ...local, ...updates }))
      }
    }
  }, ORIGIN_OUTBOUND)
}

function collectUpdates<T extends Entity | Claim>(
  conflicts: import('./merge').FieldConflict[],
  resolutions: Map<string, 'local' | 'remote'>,
  locals: T[],
): Map<string, T> {
  const updates = new Map<string, T>()
  for (const conflict of conflicts) {
    const key = `${conflict.entityId}:${conflict.field}`
    if ((resolutions.get(key) ?? conflict.winner) === 'local') continue
    const local = locals.find((item) => item.id === conflict.entityId)
    if (!local) continue
    const existing = updates.get(conflict.entityId) ?? { ...local }
    const field = conflict.field as keyof T
    if (field in existing) {
      Object.assign(existing, { [field]: conflict.remoteValue })
      updates.set(conflict.entityId, existing)
    }
  }
  return updates
}

export function startBidirectionalSync(): Unsubscribe {
  if (outboundSubscribed) return () => {}
  outboundSubscribed = true

  const store = useStudioStore.getState

  const unsubOutbound = onYjsChange((remoteEntities, remoteClaims) => {
    const state = store()
    const result = applyRemoteUpdate(
      remoteEntities,
      remoteClaims,
      state.entities,
      state.claims,
    )
    useStudioStore.setState({
      entities: result.entities,
      claims: result.claims,
    })
  })

  const unsubInbound = subscribeToYjs(
    (remoteEntities) => {
      const state = store()
      const result = applyRemoteUpdate(
        remoteEntities,
        getYjsClaims(),
        state.entities,
        state.claims,
      )
      useStudioStore.setState({
        entities: result.entities,
        claims: result.claims,
      })
    },
    (remoteClaims) => {
      const state = store()
      const result = applyRemoteUpdate(
        getYjsEntities(),
        remoteClaims,
        state.entities,
        state.claims,
      )
      useStudioStore.setState({
        entities: result.entities,
        claims: result.claims,
      })
    },
  )

  return () => {
    unsubOutbound()
    unsubInbound()
    outboundSubscribed = false
  }
}
