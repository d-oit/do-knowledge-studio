import { RepositoryBase } from './base';

export interface EntityVersion {
  id: string;
  entity_id: string;
  name: string;
  type: string;
  description: string | null;
  metadata: string | null;
  version: number;
  created_at: string;
}

export async function captureEntityVersion(
  repo: RepositoryBase,
  entityId: string,
): Promise<void> {
  try {
    const entity = await repo.exec({
      sql: `SELECT * FROM entities WHERE id = ?`,
      bind: [entityId],
      returnValue: 'resultRows',
      rowMode: 'object',
    }) as { id: string; name: string; type: string; description: string | null; metadata: string | null }[];

    if (entity.length === 0) return;

    const e = entity[0];

    // Get current max version
    const maxVersion = await repo.exec({
      sql: `SELECT COALESCE(MAX(version), 0) as max_version FROM entity_versions WHERE entity_id = ?`,
      bind: [entityId],
      returnValue: 'resultRows',
      rowMode: 'object',
    }) as { max_version: number }[];

    const newVersion = maxVersion[0].max_version + 1;

    await repo.exec({
      sql: `INSERT INTO entity_versions (entity_id, name, type, description, metadata, version)
            VALUES (?, ?, ?, ?, ?, ?)`,
      bind: [entityId, e.name, e.type, e.description, e.metadata, newVersion],
    });
  } catch {
    // entity_versions table may not exist before migration 005 — safe to ignore
  }
}

export async function getEntityVersions(
  repo: RepositoryBase,
  entityId: string,
): Promise<EntityVersion[]> {
  const result = await repo.exec({
    sql: `SELECT * FROM entity_versions WHERE entity_id = ? ORDER BY version DESC`,
    bind: [entityId],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as EntityVersion[];
  return result;
}

export async function getEntityVersion(
  repo: RepositoryBase,
  entityId: string,
  version: number,
): Promise<EntityVersion | null> {
  const result = await repo.exec({
    sql: `SELECT * FROM entity_versions WHERE entity_id = ? AND version = ?`,
    bind: [entityId, version],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as EntityVersion[];
  return result[0] ?? null;
}

export async function restoreEntityVersion(
  repo: RepositoryBase,
  entityId: string,
  version: number,
): Promise<void> {
  const versionData = await getEntityVersion(repo, entityId, version);
  if (!versionData) return;

  // Capture current state before restore
  await captureEntityVersion(repo, entityId);

  // Restore the version
  await repo.exec({
    sql: `UPDATE entities SET name = ?, type = ?, description = ?, metadata = ?, updated_at = datetime('now')
          WHERE id = ?`,
    bind: [versionData.name, versionData.type, versionData.description, versionData.metadata, entityId],
  });
}

export async function diffEntityVersions(
  repo: RepositoryBase,
  entityId: string,
  version1: number,
  version2: number,
): Promise<{
  name: { old: string; new: string } | null;
  type: { old: string; new: string } | null;
  description: { old: string | null; new: string | null } | null;
  metadata: { old: string | null; new: string | null } | null;
}> {
  const v1 = await getEntityVersion(repo, entityId, version1);
  const v2 = await getEntityVersion(repo, entityId, version2);

  if (!v1 || !v2) {
    return { name: null, type: null, description: null, metadata: null };
  }

  return {
    name: v1.name !== v2.name ? { old: v1.name, new: v2.name } : null,
    type: v1.type !== v2.type ? { old: v1.type, new: v2.type } : null,
    description: v1.description !== v2.description ? { old: v1.description, new: v2.description } : null,
    metadata: v1.metadata !== v2.metadata ? { old: v1.metadata, new: v2.metadata } : null,
  };
}
