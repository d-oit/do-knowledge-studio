import { getSyncDoc, getDoc } from './doc'
import { entityToYMap, claimToYMap, sameEntityPayload, sameClaimPayload } from './types'
import { getConflictResolutionKey, mergeEntities, mergeClaims, type FieldConflict, type MergeResult } from './merge'
import { isTombstoned, addTombstone, getTombstone } from './tombstones'
import { clockFromRecord, compareClocks, readRecordClock, setVersionedRecord } from './causality'
import { validateInboundEntity, validateInboundClaim } from './inbound'
import { resolveEntityConflict, resolveClaimConflict } from './conflict'
import type { Entity, Claim } from '@/lib/studio/types'
import { useStudioStore } from '@/lib/studio/store'
import { translate as t } from '@/lib/i18n/messages/sync'

type Unsubscribe = () => void

/** Origin tag for outbound Yjs transactions to prevent echo loops. */
const ORIGIN_OUTBOUND = 'zustand-outbound'

let unsubscribeFns: Unsubscribe[] = []
let outboundSubscribed = false
let applyingInbound = false
let previousEntities: Entity[] = []
let previousClaims: Claim[] = []
type SyncConflictListener = (conflicts: FieldConflict[]) => void
const syncConflictListeners = new Set<SyncConflictListener>()

/** Subscribe to causal conflicts discovered while processing incoming Yjs updates. */
export function subscribeSyncConflicts(listener: SyncConflictListener): Unsubscribe {
  syncConflictListeners.add(listener)
  return () => {
    syncConflictListeners.delete(listener)
  }
}

/** Read all non-tombstoned entities from the Yjs sync document. */
export function getYjsEntities(): Entity[] {
  const sync = getSyncDoc()
  const entities: Entity[] = []
  sync.entities.forEach((data, id) => {
    const result = validateInboundEntity(data)
    if (result.success && result.data.id === id &&
        !isTombstoned(id, 'entities', clockFromRecord(data))) entities.push(result.data)
  })
  return entities
}

/** Read all non-tombstoned claims from the Yjs sync document. */
export function getYjsClaims(): Claim[] {
  const sync = getSyncDoc()
  const claims: Claim[] = []
  sync.claims.forEach((data, id) => {
    const result = validateInboundClaim(data)
    if (result.success && result.data.id === id &&
        !isTombstoned(id, 'claims', clockFromRecord(data))) claims.push(result.data)
  })
  return claims
}

/** Write an entity to the Yjs sync document. */
export function setYjsEntity(entity: Entity): void {
  const sync = getSyncDoc()
  setVersionedRecord(sync.entities, 'entities', entity.id, entityToYMap(entity), getTombstone(entity.id)?.clock)
}

/** Delete an entity from the Yjs sync document and add a tombstone. */
export function removeYjsEntity(id: string): void {
  addTombstone(id)
}

/** Write a claim to the Yjs sync document. */
export function setYjsClaim(claim: Claim): void {
  const sync = getSyncDoc()
  setVersionedRecord(sync.claims, 'claims', claim.id, claimToYMap(claim), getTombstone(claim.id, 'claims')?.clock)
}

/** Delete a claim from the Yjs sync document and add a tombstone. */
export function removeYjsClaim(id: string): void {
  addTombstone(id, undefined, 'claims')
}

/** Merge local entities and claims into the Yjs sync document with conflict tracking. */
export function mergeIntoYjs(
  entities: Entity[],
  claims: Claim[],
): MergeResult<{ entities: Entity[]; claims: Claim[] }> {
  const sync = getSyncDoc()
  const doc = getDoc()
  const existingEntities = getYjsEntities()
  const existingClaims = getYjsClaims()
  const entityResult = mergeEntities(
    existingEntities,
    entities.filter((entity) => !isTombstoned(entity.id)),
  )
  const claimResult = mergeClaims(
    existingClaims,
    claims.filter((claim) => !isTombstoned(claim.id, 'claims')),
  )

  const deletionConflicts: FieldConflict[] = []
  const conflictedEntityIds = new Set<string>()
  const conflictedClaimIds = new Set<string>()
  for (const [kind, map] of [['entity', sync.entities], ['claim', sync.claims]] as const) {
    map.forEach((raw, id) => {
      const recordKind = kind === 'entity' ? 'entities' : 'claims'
      const tombstone = getTombstone(id, recordKind)
      if (!tombstone?.clock) return
      const validated = kind === 'entity'
        ? validateInboundEntity(raw)
        : validateInboundClaim(raw)
      if (!validated.success) return
      const relation = compareClocks(clockFromRecord(raw), tombstone.clock)
      if (relation !== null && relation !== 0) return
      deletionConflicts.push({
        entityId: id,
        entityType: kind,
        field: '__delete',
        localValue: validated.data,
        remoteValue: 'deleted',
        winner: 'local',
        reason: t('sync.conflict.concurrentDeleteReason'),
      })
      if (kind === 'entity') conflictedEntityIds.add(id)
      else conflictedClaimIds.add(id)
    })
  }

  const existingEntitiesById = new Map<string, Entity>()
  for (const entity of existingEntities) existingEntitiesById.set(entity.id, entity)
  const existingClaimsById = new Map<string, Claim>()
  for (const claim of existingClaims) existingClaimsById.set(claim.id, claim)
  doc.transact(() => {
    for (const entity of entityResult.merged) {
      if (conflictedEntityIds.has(entity.id)) continue
      const existing = existingEntitiesById.get(entity.id)
      if (existing && sameEntityPayload(existing, entity)) continue
      setVersionedRecord(sync.entities, 'entities', entity.id, entityToYMap(entity), getTombstone(entity.id)?.clock)
    }
    for (const claim of claimResult.merged) {
      if (conflictedClaimIds.has(claim.id)) continue
      const existing = existingClaimsById.get(claim.id)
      if (existing && sameClaimPayload(existing, claim)) continue
      setVersionedRecord(sync.claims, 'claims', claim.id, claimToYMap(claim), getTombstone(claim.id, 'claims')?.clock)
    }
  }, ORIGIN_OUTBOUND)

  const mergedEntities = [
    ...entityResult.merged.filter((entity) => !conflictedEntityIds.has(entity.id)),
    ...entities.filter((entity) => conflictedEntityIds.has(entity.id)),
  ]
  const mergedClaims = [
    ...claimResult.merged.filter((claim) => !conflictedClaimIds.has(claim.id)),
    ...claims.filter((claim) => conflictedClaimIds.has(claim.id)),
  ]
  const totalConflicts = [...entityResult.conflicts, ...claimResult.conflicts, ...deletionConflicts]
  if (totalConflicts.length > 0) {
    for (const listener of syncConflictListeners) listener(totalConflicts)
  }
  return {
    merged: { entities: mergedEntities, claims: mergedClaims },
    conflicts: totalConflicts,
  }
}

/** Apply validated remote updates to local state with conflict resolution. */
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

  const entityMap = new Map(
    localEntities.filter((entity) =>
      !isTombstoned(entity.id, 'entities', readRecordClock('entities', entity.id)),
    ).map((entity) => [entity.id, entity]),
  )
  for (const remote of validEntities) {
    if (isTombstoned(remote.id, 'entities', readRecordClock('entities', remote.id))) continue
    const local = entityMap.get(remote.id)
    entityMap.set(remote.id, local ? resolveEntityConflict(local, remote) : remote)
  }

  const claimMap = new Map(
    localClaims.filter((claim) =>
      !isTombstoned(claim.id, 'claims', readRecordClock('claims', claim.id)),
    ).map((claim) => [claim.id, claim]),
  )
  for (const remote of validClaims) {
    if (isTombstoned(remote.id, 'claims', readRecordClock('claims', remote.id))) continue
    const local = claimMap.get(remote.id)
    claimMap.set(remote.id, local ? resolveClaimConflict(local, remote) : remote)
  }

  return {
    entities: Array.from(entityMap.values()),
    claims: Array.from(claimMap.values()),
  }
}

/** Tear down all Yjs subscriptions and reset bridge state. */
export function destroyBridge(): void {
  for (const unsub of unsubscribeFns) unsub()
  unsubscribeFns = []
  outboundSubscribed = false
  applyingInbound = false
  previousEntities = []
  previousClaims = []
}

/** Initialize Yjs persistence and indexing. */
export async function initSync(): Promise<void> {
  const { initPersistence } = await import('./doc')
  await initPersistence()
}

function nextConflictTimestamp(previous?: string): string {
  const previousMilliseconds = previous ? Date.parse(previous) : Number.NaN
  const nextMilliseconds = Number.isNaN(previousMilliseconds)
    ? Date.now()
    : Math.max(Date.now(), previousMilliseconds + 1)
  return new Date(nextMilliseconds).toISOString()
}

/** Apply validated conflict choices to canonical state and the Yjs replica. */
export function applyConflictResolution(
  resolutions: Map<string, 'local' | 'remote'>,
  conflicts: FieldConflict[],
  localEntities: Entity[],
  localClaims: Claim[],
): boolean {
  const entities = new Map(localEntities.map((entity) => [entity.id, { ...entity }]))
  const claims = new Map(localClaims.map((claim) => [claim.id, { ...claim }]))
  const touchedEntities = new Set<string>()
  const touchedClaims = new Set<string>()
  const pendingTombstones: Array<{ id: string; kind: 'entities' | 'claims' }> = []

  for (const conflict of conflicts) {
    const key = getConflictResolutionKey(conflict)
    if (conflict.field === '__delete') {
      if ((resolutions.get(key) ?? conflict.winner) === 'local') {
        if (conflict.entityType === 'entity') {
          const restored = validateInboundEntity(conflict.localValue)
          if (!restored.success) return false
          entities.set(conflict.entityId, restored.data)
          touchedEntities.add(conflict.entityId)
        } else {
          const restored = validateInboundClaim(conflict.localValue)
          if (!restored.success) return false
          claims.set(conflict.entityId, restored.data)
          touchedClaims.add(conflict.entityId)
        }
      } else if (conflict.entityType === 'entity') {
        entities.delete(conflict.entityId)
        pendingTombstones.push({ id: conflict.entityId, kind: 'entities' })
      } else {
        claims.delete(conflict.entityId)
        pendingTombstones.push({ id: conflict.entityId, kind: 'claims' })
      }
      continue
    }

    if (conflict.entityType === 'entity') touchedEntities.add(conflict.entityId)
    else touchedClaims.add(conflict.entityId)
    if (conflict.entityType === 'entity' && conflict.field === 'tags') {
      const entity = entities.get(conflict.entityId)
      if (!entity || !Array.isArray(conflict.remoteValue)) return false
      const remoteTags = conflict.remoteValue.filter(
        (tag: unknown): tag is string => typeof tag === 'string',
      )
      if (remoteTags.length !== conflict.remoteValue.length) return false
      entity.tags = Array.from(new Set([...entity.tags, ...remoteTags]))
      continue
    }
    if ((resolutions.get(key) ?? conflict.winner) === 'local') continue
    if (conflict.entityType === 'entity' && conflict.field.startsWith('links[')) {
      const targetId = conflict.field.slice('links['.length).split(']')[0]
      const entity = entities.get(conflict.entityId)
      const link = entity?.links.find((item) => item.targetId === targetId)
      if (!link || typeof conflict.remoteValue !== 'string') return false
      link.relation = conflict.remoteValue
      continue
    }
    const record = conflict.entityType === 'entity'
      ? entities.get(conflict.entityId)
      : claims.get(conflict.entityId)
    if (!record || !(conflict.field in record)) return false
    Object.assign(record, { [conflict.field]: conflict.remoteValue })
  }

  for (const id of touchedEntities) {
    const entity = entities.get(id)
    if (entity) entity.updatedAt = nextConflictTimestamp(entity.updatedAt)
  }
  for (const id of touchedClaims) {
    const claim = claims.get(id)
    if (claim) {
      claim.updatedAt = nextConflictTimestamp(claim.updatedAt)
      claim.version = (claim.version ?? 1) + 1
    }
  }

  const validatedEntities = Array.from(entities.values(), validateInboundEntity)
  const validatedClaims = Array.from(claims.values(), validateInboundClaim)
  if (validatedEntities.some((result) => !result.success) ||
      validatedClaims.some((result) => !result.success)) return false

  const nextEntities = validatedEntities.map((result) => result.success ? result.data : null)
    .filter((entity): entity is Entity => entity !== null)
  const nextClaims = validatedClaims.map((result) => result.success ? result.data : null)
    .filter((claim): claim is Claim => claim !== null)
  const sync = getSyncDoc()
  const doc = getDoc()
  applyingInbound = true
  try {
    useStudioStore.setState({ entities: nextEntities, claims: nextClaims })
    useStudioStore.getState().pushHistory()
    previousEntities = nextEntities
    previousClaims = nextClaims
    doc.transact(() => {
      for (const tombstone of pendingTombstones) {
        addTombstone(tombstone.id, undefined, tombstone.kind)
      }
      for (const entity of nextEntities) {
        if (!touchedEntities.has(entity.id)) continue
        setVersionedRecord(sync.entities, 'entities', entity.id, entityToYMap(entity), getTombstone(entity.id)?.clock)
      }
      for (const claim of nextClaims) {
        if (!touchedClaims.has(claim.id)) continue
        setVersionedRecord(sync.claims, 'claims', claim.id, claimToYMap(claim), getTombstone(claim.id, 'claims')?.clock)
      }
    }, ORIGIN_OUTBOUND)
  } finally {
    applyingInbound = false
  }
  return true
}

/** Commit a validated join/resync reconciliation without echoing it outbound. */
export function commitMergedState(entities: Entity[], claims: Claim[]): boolean {
  const validatedEntities = entities.map(validateInboundEntity)
  const validatedClaims = claims.map(validateInboundClaim)
  if (validatedEntities.some((result) => !result.success) ||
      validatedClaims.some((result) => !result.success)) return false
  const normalizedEntities = validatedEntities.map((result) => result.success ? result.data : null)
    .filter((entity): entity is Entity => entity !== null)
  const normalizedClaims = validatedClaims.map((result) => result.success ? result.data : null)
    .filter((claim): claim is Claim => claim !== null)
  const state = useStudioStore.getState()
  if (JSON.stringify(state.entities) === JSON.stringify(normalizedEntities) &&
      JSON.stringify(state.claims) === JSON.stringify(normalizedClaims)) return true
  applyingInbound = true
  try {
    useStudioStore.setState({ entities: normalizedEntities, claims: normalizedClaims })
    useStudioStore.getState().pushHistory()
    previousEntities = normalizedEntities
    previousClaims = normalizedClaims
  } finally {
    applyingInbound = false
  }
  return true
}

/** Start one bidirectional subscription between canonical state and the Yjs document. */
export function startBidirectionalSync(): Unsubscribe {
  if (outboundSubscribed) return () => undefined
  outboundSubscribed = true

  const store = useStudioStore
  previousEntities = store.getState().entities
  previousClaims = store.getState().claims

  const unsubscribeStore = store.subscribe((state) => {
    if (applyingInbound) return
    const entitiesChanged = state.entities !== previousEntities
    const claimsChanged = state.claims !== previousClaims
    if (!entitiesChanged && !claimsChanged) return

    const sync = getSyncDoc()
    const doc = getDoc()
    doc.transact(() => {
      if (entitiesChanged) {
        const previousEntityById = new Map<string, Entity>()
        for (const entity of previousEntities) previousEntityById.set(entity.id, entity)
        for (const entity of state.entities) {
          const previous = previousEntityById.get(entity.id)
          if (!previous || !sameEntityPayload(previous, entity)) {
            setVersionedRecord(sync.entities, 'entities', entity.id, entityToYMap(entity), getTombstone(entity.id)?.clock)
          }
          previousEntityById.delete(entity.id)
        }
        for (const entity of previousEntityById.values()) addTombstone(entity.id)
      }
      if (claimsChanged) {
        const previousClaimById = new Map<string, Claim>()
        for (const claim of previousClaims) previousClaimById.set(claim.id, claim)
        for (const claim of state.claims) {
          const previous = previousClaimById.get(claim.id)
          if (!previous || !sameClaimPayload(previous, claim)) {
            setVersionedRecord(sync.claims, 'claims', claim.id, claimToYMap(claim), getTombstone(claim.id, 'claims')?.clock)
          }
          previousClaimById.delete(claim.id)
        }
        for (const claim of previousClaimById.values()) addTombstone(claim.id, undefined, 'claims')
      }
    }, ORIGIN_OUTBOUND)
    previousEntities = state.entities
    previousClaims = state.claims
  })

  const doc = getDoc()
  const onUpdate = (_update: Uint8Array, origin: unknown) => {
    if (origin === ORIGIN_OUTBOUND || applyingInbound) return
    const state = store.getState()
    const sync = getSyncDoc()
    const causalConflicts: FieldConflict[] = []
    for (const [kind, map] of [['entity', sync.entities], ['claim', sync.claims]] as const) {
      map.forEach((raw, id) => {
        const recordKind = kind === 'entity' ? 'entities' : 'claims'
        const validated = kind === 'entity'
          ? validateInboundEntity(raw)
          : validateInboundClaim(raw)
        if (!validated.success) return
        const tombstone = getTombstone(id, recordKind)
        if (!tombstone?.clock) return
        const relation = compareClocks(clockFromRecord(raw), tombstone.clock)
        if (relation !== null && relation !== 0) return
        causalConflicts.push({
          entityId: id,
          entityType: kind,
          field: '__delete',
          localValue: validated.data,
          remoteValue: 'deleted',
          winner: 'local',
          reason: t('sync.conflict.concurrentDeleteReason'),
        })
      })
    }
    if (causalConflicts.length > 0) {
      for (const listener of syncConflictListeners) listener(causalConflicts)
    }
    const result = applyRemoteUpdate(
      getYjsEntities(),
      getYjsClaims(),
      state.entities,
      state.claims,
    )
    const conflictedEntities = new Set(causalConflicts.filter((conflict) => conflict.entityType === 'entity')
      .map((conflict) => conflict.entityId))
    const conflictedClaims = new Set(causalConflicts.filter((conflict) => conflict.entityType === 'claim')
      .map((conflict) => conflict.entityId))
    result.entities = [
      ...result.entities.filter((entity) => !conflictedEntities.has(entity.id)),
      ...state.entities.filter((entity) => conflictedEntities.has(entity.id)),
    ]
    result.claims = [
      ...result.claims.filter((claim) => !conflictedClaims.has(claim.id)),
      ...state.claims.filter((claim) => conflictedClaims.has(claim.id)),
    ]
    const changed =
      JSON.stringify(result.entities) !== JSON.stringify(state.entities) ||
      JSON.stringify(result.claims) !== JSON.stringify(state.claims)
    if (!changed) return
    applyingInbound = true
    try {
      store.setState({ entities: result.entities, claims: result.claims })
      store.getState().pushHistory()
      previousEntities = result.entities
      previousClaims = result.claims
    } finally {
      applyingInbound = false
    }
  }
  doc.on('update', onUpdate)
  const unsubscribeDoc = () => doc.off('update', onUpdate)

  const unsubscribe = () => {
    unsubscribeStore()
    unsubscribeDoc()
    outboundSubscribed = false
  }
  unsubscribeFns.push(unsubscribe)
  return unsubscribe
}
