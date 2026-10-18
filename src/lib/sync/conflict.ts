import type { Entity, Claim } from '@/lib/studio/types'
import { compareRecordTimestamps, mergeEntities, mergeClaims } from './merge'

/** Resolve an entity conflict with the canonical merge tie-break policy. */
export function resolveEntityConflict(local: Entity, remote: Entity): Entity {
  return mergeEntities([local], [remote]).merged[0] ?? local
}

/** Resolve a claim conflict with the canonical merge tie-break policy. */
export function resolveClaimConflict(local: Claim, remote: Claim): Claim {
  return mergeClaims([local], [remote]).merged[0] ?? local
}

/** Batch-resolve entity conflicts and return merged results with resolution log. */
export function resolveEntityConflicts(
  localEntities: Entity[],
  remoteEntities: Entity[],
): { merged: Entity[]; conflicts: { id: string; resolution: 'local' | 'remote' }[] } {
  const localMap = new Map(localEntities.map((e) => [e.id, e]))
  const remoteMap = new Map(remoteEntities.map((e) => [e.id, e]))
  const merged: Entity[] = []
  const conflicts: { id: string; resolution: 'local' | 'remote' }[] = []

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])
  for (const id of allIds) {
    const local = localMap.get(id)
    const remote = remoteMap.get(id)
    if (local && remote) {
      const resolved = resolveEntityConflict(local, remote)
      merged.push(resolved)
      const order = compareRecordTimestamps(local.updatedAt, remote.updatedAt)
      const resolution = order > 0
        ? 'local'
        : order < 0
          ? 'remote'
          : (JSON.stringify(local) ?? '') <= (JSON.stringify(remote) ?? '') ? 'local' : 'remote'
      conflicts.push({ id, resolution })
    } else if (local) {
      merged.push(local)
    } else if (remote) {
      merged.push(remote)
    }
  }

  return { merged, conflicts }
}

/** Batch-resolve claim conflicts and return merged results with resolution log. */
export function resolveClaimConflicts(
  localClaims: Claim[],
  remoteClaims: Claim[],
): { merged: Claim[]; conflicts: { id: string; resolution: 'local' | 'remote' }[] } {
  const localMap = new Map(localClaims.map((c) => [c.id, c]))
  const remoteMap = new Map(remoteClaims.map((c) => [c.id, c]))
  const merged: Claim[] = []
  const conflicts: { id: string; resolution: 'local' | 'remote' }[] = []

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])
  for (const id of allIds) {
    const local = localMap.get(id)
    const remote = remoteMap.get(id)
    if (local && remote) {
      const resolved = resolveClaimConflict(local, remote)
      merged.push(resolved)
      const order = compareRecordTimestamps(
        local.updatedAt ?? local.createdAt ?? '',
        remote.updatedAt ?? remote.createdAt ?? '',
      )
      const resolution = order > 0
        ? 'local'
        : order < 0
          ? 'remote'
          : (JSON.stringify(local) ?? '') <= (JSON.stringify(remote) ?? '') ? 'local' : 'remote'
      conflicts.push({ id, resolution })
    } else if (local) {
      merged.push(local)
    } else if (remote) {
      merged.push(remote)
    }
  }

  return { merged, conflicts }
}
