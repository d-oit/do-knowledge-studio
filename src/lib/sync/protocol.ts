/**
 * P2P Sync Protocol.
 *
 * Defines message types for syncing knowledge base data between peers.
 * Uses a simple snapshot-based approach: full entity/claim/note data exchange
 * with conflict resolution by timestamp.
 */
import type { Entity, Claim, Note, Link } from '../../lib/validation';

export interface SyncSnapshot {
  entities: Entity[];
  claims: Claim[];
  notes: Note[];
  links: Link[];
  timestamp: string;
  deviceId: string;
}

export interface SyncMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'sync-request' | 'sync-data' | 'sync-ack';
  payload: unknown;
}

export interface SyncResult {
  merged: number;
  conflicts: number;
  timestamp: string;
}

export function createSyncSnapshot(
  entities: Entity[],
  claims: Claim[],
  notes: Note[],
  links: Link[],
  deviceId: string,
): SyncSnapshot {
  return {
    entities,
    claims,
    notes,
    links,
    timestamp: new Date().toISOString(),
    deviceId,
  };
}

export function mergeSnapshots(
  local: SyncSnapshot,
  remote: SyncSnapshot,
): { merged: SyncSnapshot; conflicts: number } {
  const entityMap = new Map<string, Entity>();
  for (const e of local.entities) {
    if (e.id) entityMap.set(e.id, e);
  }

  let conflicts = 0;
  for (const e of remote.entities) {
    if (!e.id) continue;
    const existing = entityMap.get(e.id);
    if (existing) {
      const localTime = new Date(existing.updated_at ?? existing.created_at ?? 0).getTime();
      const remoteTime = new Date(e.updated_at ?? e.created_at ?? 0).getTime();
      if (remoteTime > localTime) {
        entityMap.set(e.id, e);
        conflicts++;
      }
    } else {
      entityMap.set(e.id, e);
    }
  }

  const claimMap = new Map<string, Claim>();
  for (const c of local.claims) {
    if (c.id) claimMap.set(c.id, c);
  }
  for (const c of remote.claims) {
    if (!c.id) continue;
    if (!claimMap.has(c.id)) {
      claimMap.set(c.id, c);
    }
  }

  const noteMap = new Map<string, Note>();
  for (const n of local.notes) {
    if (n.id) noteMap.set(n.id, n);
  }
  for (const n of remote.notes) {
    if (!n.id) continue;
    if (!noteMap.has(n.id)) {
      noteMap.set(n.id, n);
    }
  }

  const linkSet = new Set<string>();
  const mergedLinks: Link[] = [];
  for (const l of [...local.links, ...remote.links]) {
    const key = `${l.source_id}->${l.target_id}->${l.relation}`;
    if (!linkSet.has(key)) {
      linkSet.add(key);
      mergedLinks.push(l);
    }
  }

  return {
    merged: {
      entities: [...entityMap.values()],
      claims: [...claimMap.values()],
      notes: [...noteMap.values()],
      links: mergedLinks,
      timestamp: new Date().toISOString(),
      deviceId: local.deviceId,
    },
    conflicts,
  };
}
