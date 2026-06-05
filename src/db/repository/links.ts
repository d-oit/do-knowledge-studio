import { z } from 'zod';
import { Link, LinkSchema, Entity, EntitySchema } from '../../lib/validation';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { perf } from '../../lib/perf';
import { RepositoryBase } from './base';

export async function createLink(base: RepositoryBase, link: Omit<Link, 'id' | 'created_at' | 'updated_at'>): Promise<Link> {
  try {
    const validated = LinkSchema.omit({ id: true, created_at: true, updated_at: true }).parse(link);
    const { source_id, target_id, relation, metadata } = validated;
    const rows = await base.execRows({
      sql: `INSERT INTO links (source_id, target_id, relation, metadata)
            VALUES (?, ?, ?, ?) RETURNING *`,
      bind: [source_id, target_id, relation, metadata ? JSON.stringify(metadata) : null],
      returnValue: 'resultRows',
      rowMode: 'object',
    });

    return base.parseMetadata(LinkSchema, rows[0]);
  } catch (err) {
    logger.error('Failed to create link', err);
    throw new AppError('Failed to create link', 'DB_ERROR', err);
  }
}

export async function getAllLinks(base: RepositoryBase, options?: { limit?: number; offset?: number }): Promise<Link[]> {
  perf.mark('sqlite-query');
  try {
    let sql = `SELECT * FROM links`;
    const bind: (string | number)[] = [];
    if (options?.limit !== undefined) {
      sql += ` LIMIT ?`;
      bind.push(options.limit);
    }
    if (options?.offset !== undefined) {
      sql += ` OFFSET ?`;
      bind.push(options.offset);
    }
    const rows = await base.execRows({
      sql,
      bind: bind.length > 0 ? bind : undefined,
      returnValue: 'resultRows',
      rowMode: 'object',
    });

    return rows.map((r) => base.parseMetadata(LinkSchema, r));
  } catch (err) {
    logger.error('Failed to fetch links', err);
    throw new AppError('Failed to fetch links', 'DB_ERROR', err);
  } finally {
    perf.measure('sqlite-query-links', 'sqlite-query');
  }
}

export async function deleteLink(base: RepositoryBase, id: string): Promise<void> {
  try {
    await base.exec({
      sql: `DELETE FROM links WHERE id = ?`,
      bind: [id],
    });
  } catch (err) {
    logger.error('Failed to delete link', err);
    throw new AppError('Failed to delete link', 'DB_ERROR', err);
  }
}

export async function getBacklinks(base: RepositoryBase, entityId: string): Promise<Entity[]> {
  try {
    const rows = await base.execRows({
      sql: `SELECT DISTINCT e.* FROM entities e
            JOIN links l ON e.id = l.source_id
            WHERE l.target_id = ?
            ORDER BY e.name ASC`,
      bind: [entityId],
      returnValue: 'resultRows',
      rowMode: 'object',
    });

    return rows.map((r) => base.parseMetadata(EntitySchema, r));
  } catch (err) {
    logger.error('Failed to fetch backlinks', err);
    throw new AppError('Failed to fetch backlinks', 'DB_ERROR', err);
  }
}

export async function getBacklinkCount(base: RepositoryBase, entityId: string): Promise<number> {
  try {
    const results = await base.exec({
      sql: `SELECT COUNT(DISTINCT source_id) as count FROM links WHERE target_id = ?`,
      bind: [entityId],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.object({ count: z.number() })).parse(results);
    return rows[0]?.count ?? 0;
  } catch (err) {
    logger.error('Failed to fetch backlink count', err);
    throw new AppError('Failed to fetch backlink count', 'DB_ERROR', err);
  }
}
