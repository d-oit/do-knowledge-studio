import { RepositoryBase } from './base';
import type { Tag } from '../../lib/validation';

export interface TagWithCount extends Tag {
  entity_count: number;
}

export async function createTag(
  repo: RepositoryBase,
  name: string,
  color?: string,
): Promise<Tag> {
  const result = await repo.exec({
    sql: `INSERT INTO tags (name, color) VALUES (?, ?) RETURNING *`,
    bind: [name, color ?? null],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as { id: string; name: string; color: string | null; created_at: string }[];
  return result[0];
}

export async function getAllTags(
  repo: RepositoryBase,
): Promise<TagWithCount[]> {
  const result = await repo.exec({
    sql: `SELECT t.*, COUNT(et.entity_id) as entity_count
          FROM tags t
          LEFT JOIN entity_tags et ON t.id = et.tag_id
          GROUP BY t.id
          ORDER BY t.name`,
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as TagWithCount[];
  return result;
}

export async function getTagByName(
  repo: RepositoryBase,
  name: string,
): Promise<Tag | null> {
  const result = await repo.exec({
    sql: `SELECT * FROM tags WHERE name = ?`,
    bind: [name],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as { id: string; name: string; color: string | null; created_at: string }[];
  return result[0] ?? null;
}

export async function deleteTag(
  repo: RepositoryBase,
  id: string,
): Promise<void> {
  await repo.exec({
    sql: `DELETE FROM tags WHERE id = ?`,
    bind: [id],
  });
}

export async function addTagToEntity(
  repo: RepositoryBase,
  entityId: string,
  tagId: string,
): Promise<void> {
  await repo.exec({
    sql: `INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)`,
    bind: [entityId, tagId],
  });
}

export async function removeTagFromEntity(
  repo: RepositoryBase,
  entityId: string,
  tagId: string,
): Promise<void> {
  await repo.exec({
    sql: `DELETE FROM entity_tags WHERE entity_id = ? AND tag_id = ?`,
    bind: [entityId, tagId],
  });
}

export async function getTagsByEntityId(
  repo: RepositoryBase,
  entityId: string,
): Promise<Tag[]> {
  const result = await repo.exec({
    sql: `SELECT t.* FROM tags t
          INNER JOIN entity_tags et ON t.id = et.tag_id
          WHERE et.entity_id = ?
          ORDER BY t.name`,
    bind: [entityId],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as Tag[];
  return result;
}

export async function getEntitiesByTagId(
  repo: RepositoryBase,
  tagId: string,
): Promise<string[]> {
  const result = await repo.exec({
    sql: `SELECT entity_id FROM entity_tags WHERE tag_id = ?`,
    bind: [tagId],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as { entity_id: string }[];
  return result.map(r => r.entity_id);
}
