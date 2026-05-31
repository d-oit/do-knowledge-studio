import { z } from 'zod';
import { Entity, EntitySchema } from '../../lib/validation';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { perf } from '../../lib/perf';
import { RepositoryBase } from './base';
import { RankedResult } from './types';

const SearchRelatedRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().nullable().optional(),
  relation: z.string(),
  source_id: z.string(),
  target_id: z.string(),
});

export async function createEntity(base: RepositoryBase, entity: Omit<Entity, 'id' | 'created_at' | 'updated_at'>): Promise<Entity & { rowid: number }> {
  try {
    const validated = EntitySchema.omit({ id: true, created_at: true, updated_at: true }).parse(entity);
    const { name, type, description, metadata } = validated;
    const result = await base.exec({
      sql: `INSERT INTO entities (name, type, description, metadata)
            VALUES (?, ?, ?, ?) RETURNING *, rowid`,
      bind: [name, type, description ?? null, metadata ? JSON.stringify(metadata) : null],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(result);

    const parsed = base.parseMetadata(EntitySchema, rows[0]);
    const row = rows[0] as Record<string, unknown>;
    return { ...parsed, rowid: row.rowid as number };
  } catch (err) {
    logger.error('Failed to create entity', err);
    throw new AppError('Failed to create entity', 'DB_ERROR', err);
  }
}

export async function getAllEntities(base: RepositoryBase, options?: { limit?: number; offset?: number }): Promise<Entity[]> {
  perf.mark('sqlite-query');
  try {
    let sql = `SELECT * FROM entities ORDER BY name ASC`;
    const bind: (string | number)[] = [];
    if (options?.limit !== undefined) {
      sql += ` LIMIT ?`;
      bind.push(options.limit);
    }
    if (options?.offset !== undefined) {
      sql += ` OFFSET ?`;
      bind.push(options.offset);
    }
    const results = await base.exec({
      sql,
      bind: bind.length > 0 ? bind : undefined,
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);

    return rows.map((r) => base.parseMetadata(EntitySchema, r));
  } catch (err) {
    logger.error('Failed to fetch entities', err);
    throw new AppError('Failed to fetch entities', 'DB_ERROR', err);
  } finally {
    perf.measure('sqlite-query-entities', 'sqlite-query');
  }
}

export async function getEntities(base: RepositoryBase, options: {
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'created_at' | 'updated_at';
  sortOrder?: 'ASC' | 'DESC';
  type?: string;
  search?: string;
} = {}): Promise<Entity[]> {
  perf.mark('sqlite-query');
  try {
    const { limit, offset, sortBy = 'name', sortOrder = 'ASC', type, search } = options;

    let sql = `SELECT * FROM entities`;
    const bind: (string | number)[] = [];
    const whereClauses: string[] = [];

    if (type) {
      whereClauses.push(`type = ?`);
      bind.push(type);
    }

    if (search) {
      whereClauses.push(`(name LIKE ? OR description LIKE ?)`);
      bind.push(`%${search}%`, `%${search}%`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    const validSortFields = ['name', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder === 'DESC' ? 'DESC' : 'ASC';

    sql += ` ORDER BY ${sortField} ${order}`;

    if (limit !== undefined) {
      sql += ` LIMIT ?`;
      bind.push(limit);
    }
    if (offset !== undefined) {
      sql += ` OFFSET ?`;
      bind.push(offset);
    }

    const results = await base.exec({
      sql,
      bind: bind.length > 0 ? bind : undefined,
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);

    return rows.map((r) => base.parseMetadata(EntitySchema, r));
  } catch (err) {
    logger.error('Failed to fetch entities with filters', err);
    throw new AppError('Failed to fetch entities with filters', 'DB_ERROR', err);
  } finally {
    perf.measure('sqlite-query-entities-advanced', 'sqlite-query');
  }
}

export async function getEntitiesCount(base: RepositoryBase, options: { type?: string; search?: string } = {}): Promise<number> {
  try {
    const { type, search } = options;
    let sql = `SELECT COUNT(*) as count FROM entities`;
    const bind: (string | number)[] = [];
    const whereClauses: string[] = [];

    if (type) {
      whereClauses.push(`type = ?`);
      bind.push(type);
    }

    if (search) {
      whereClauses.push(`(name LIKE ? OR description LIKE ?)`);
      bind.push(`%${search}%`, `%${search}%`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    const results = await base.exec({
      sql,
      bind: bind.length > 0 ? bind : undefined,
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.object({ count: z.number() })).parse(results);
    return rows[0].count;
  } catch (err) {
    logger.error('Failed to count entities', err);
    throw new AppError('Failed to count entities', 'DB_ERROR', err);
  }
}

export async function getEntityById(base: RepositoryBase, id: string): Promise<(Entity & { rowid: number }) | null> {
  try {
    const results = await base.exec({
      sql: `SELECT *, rowid FROM entities WHERE id = ?`,
      bind: [id],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);
    if (rows.length === 0) return null;

    const parsed = base.parseMetadata(EntitySchema, rows[0]);
    return { ...parsed, rowid: (rows[0] as { rowid: number }).rowid };
  } catch (err) {
    logger.error('Failed to fetch entity by id', err);
    throw new AppError('Failed to fetch entity by id', 'DB_ERROR', err);
  }
}

export async function getEntityByName(base: RepositoryBase, name: string): Promise<Entity | null> {
  try {
    const results = await base.exec({
      sql: `SELECT * FROM entities WHERE name = ?`,
      bind: [name],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);
    if (rows.length === 0) return null;

    return base.parseMetadata(EntitySchema, rows[0]);
  } catch (err) {
    logger.error('Failed to fetch entity by name', err);
    throw new AppError('Failed to fetch entity by name', 'DB_ERROR', err);
  }
}

export async function updateEntity(base: RepositoryBase, id: string, entity: Partial<Entity>): Promise<Entity> {
  try {
    const current = await getEntityById(base, id);
    if (!current) throw new AppError('Entity not found', 'NOT_FOUND');

    const validated = EntitySchema.partial().parse(entity);
    const name = validated.name ?? current.name;
    const type = validated.type ?? current.type;
    const description = validated.description ?? current.description;
    const metadata = validated.metadata ?? current.metadata;

    const result = await base.exec({
      sql: `UPDATE entities SET name = ?, type = ?, description = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
      bind: [name, type, description ?? null, metadata ? JSON.stringify(metadata) : null, id],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(result);

    return base.parseMetadata(EntitySchema, rows[0]);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('Failed to update entity', err);
    throw new AppError('Failed to update entity', 'DB_ERROR', err);
  }
}

export async function deleteEntity(base: RepositoryBase, id: string): Promise<void> {
  try {
    await base.exec({
      sql: `DELETE FROM entities WHERE id = ?`,
      bind: [id],
    });
  } catch (err) {
    logger.error('Failed to delete entity', err);
    throw new AppError('Failed to delete entity', 'DB_ERROR', err);
  }
}

export async function searchEntities(base: RepositoryBase, query: string): Promise<Entity[]> {
  try {
    perf.mark('sqlite-query');
    const ftsQuery = query.trim().replace(/[^\w\s-]/g, '').split(/\s+/).filter(Boolean).map(t => `${t}*`).join(' ');
    const results = await base.exec({
      sql: `SELECT DISTINCT e.* FROM entities e
            JOIN entity_search_idx s ON e.rowid = s.rowid
            WHERE s MATCH ?
            ORDER BY rank`,
      bind: [ftsQuery],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const resultRows = z.array(z.unknown()).parse(results);

    if (resultRows.length === 0) {
      const fallback = await base.exec({
        sql: `SELECT * FROM entities
              WHERE name LIKE ? OR description LIKE ?
              ORDER BY name ASC
              LIMIT 50`,
        bind: [`%${query}%`, `%${query}%`],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const fallbackRows = z.array(z.unknown()).parse(fallback);
      perf.measure('sqlite-query-search-fallback', 'sqlite-query');

      return fallbackRows.map((r) => base.parseMetadata(EntitySchema, r));
    }

    perf.measure('sqlite-query-search-fts', 'sqlite-query');

    return resultRows.map((r) => base.parseMetadata(EntitySchema, r));
  } catch (err) {
    logger.error('Failed to search entities', err);
    throw new AppError('Failed to search entities', 'DB_ERROR', err);
  }
}

export async function searchRelated(base: RepositoryBase, query: string, options?: { excludeIds?: Set<string> }): Promise<RankedResult[]> {
  try {
    perf.mark('sqlite-query');
    const ftsQuery = query.trim().replace(/[^\w\s-]/g, '').split(/\s+/).filter(Boolean).map(t => `${t}*`).join(' ');
    const results = await base.exec({
      sql: `SELECT DISTINCT e.id, e.name, e.type, e.description,
            l.relation, l.source_id, l.target_id
            FROM entities e
            JOIN links l ON (l.source_id = e.id OR l.target_id = e.id)
            JOIN entities e2 ON (
              (l.source_id = e2.id AND e2.id != e.id) OR
              (l.target_id = e2.id AND e2.id != e.id)
            )
            JOIN entity_search_idx s ON e2.rowid = s.rowid
            WHERE s MATCH ?
            ORDER BY e.name ASC
            LIMIT 20`,
      bind: [ftsQuery],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(SearchRelatedRowSchema).parse(results);
    perf.measure('sqlite-query-search-related', 'sqlite-query');
    return rows
      .filter((r) => !options?.excludeIds?.has(r.id))
      .map((r) => ({
        id: r.id,
        title: r.name,
        type: r.type,
        content: r.description ?? '',
        score: 0,
        stage: 'related' as const,
      }));
  } catch (err) {
    logger.error('Failed to search related entities', err);
    return [];
  }
}
