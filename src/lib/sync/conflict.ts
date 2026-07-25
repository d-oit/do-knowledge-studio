import type { Entity, Claim } from '@/lib/studio/types'

export function resolveEntityConflict(local: Entity, remote: Entity): Entity {
  const localTime = local.updatedAt ?? local.createdAt ?? ''
  const remoteTime = remote.updatedAt ?? remote.createdAt ?? ''
  return remoteTime >= localTime ? remote : local
}

export function resolveClaimConflict(local: Claim, remote: Claim): Claim {
  const localTime = local.updatedAt ?? local.createdAt ?? ''
  const remoteTime = remote.updatedAt ?? remote.createdAt ?? ''
  return remoteTime >= localTime ? remote : local
}

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
      conflicts.push({ id, resolution: resolved === remote ? 'remote' : 'local' })
    } else if (local) {
      merged.push(local)
    } else if (remote) {
      merged.push(remote)
    }
  }

  return { merged, conflicts }
}

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
      conflicts.push({ id, resolution: resolved === remote ? 'remote' : 'local' })
    } else if (local) {
      merged.push(local)
    } else if (remote) {
      merged.push(remote)
    }
  }

  return { merged, conflicts }
}
