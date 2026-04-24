import { getDb, SQLiteDB } from './client';
import { Entity, Claim, Note, Link } from '../lib/validation';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export class Repository {
  private get db(): SQLiteDB {
    return getDb();
  }

  // --- Entities ---
  async createEntity(entity: Omit<Entity, 'id' | 'created_at' | 'updated_at'>): Promise<Entity> {
    try {
      const { name, type, description, metadata } = entity;
      const result = await this.db.exec({
        sql: `INSERT INTO entities (name, type, description, metadata)
              VALUES (?, ?, ?, ?) RETURNING *`,
        bind: [name, type, description ?? null, metadata ? JSON.stringify(metadata) : null],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Record<string, unknown>[];
      return this.parseMetadata<Entity>(result[0]);
    } catch (err) {
      logger.error('Failed to create entity', err);
      throw new AppError('Failed to create entity', 'DB_ERROR', err);
    }
  }

  async getAllEntities(): Promise<Entity[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM entities ORDER BY name ASC`,
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Record<string, unknown>[];
      return results.map((r) => this.parseMetadata<Entity>(r));
    } catch (err) {
      logger.error('Failed to fetch entities', err);
      throw new AppError('Failed to fetch entities', 'DB_ERROR', err);
    }
  }

  async getEntityByName(name: string): Promise<Entity | null> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM entities WHERE name = ?`,
        bind: [name],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Record<string, unknown>[];
      if (results.length === 0) return null;
      return this.parseMetadata<Entity>(results[0]);
    } catch (err) {
      logger.error('Failed to fetch entity by name', err);
      throw new AppError('Failed to fetch entity by name', 'DB_ERROR', err);
    }
  }

  async searchEntities(query: string): Promise<Entity[]> {
    try {
      // Use FTS5 for search
      const results = await this.db.exec({
        sql: `SELECT DISTINCT e.* FROM entities e
              JOIN search_idx s ON e.id = s.entity_id
              WHERE search_idx MATCH ?
              ORDER BY rank`,
        bind: [query],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Record<string, unknown>[];

      // Fallback to LIKE if FTS5 returns nothing or for simple queries
      if (results.length === 0) {
        const fallback = await this.db.exec({
          sql: `SELECT * FROM entities
                WHERE name LIKE ? OR description LIKE ?
                ORDER BY name ASC`,
          bind: [`%${query}%`, `%${query}%`],
          returnValue: 'resultRows',
          rowMode: 'object',
        }) as Record<string, unknown>[];
        return fallback.map((r) => this.parseMetadata<Entity>(r));
      }

      return results.map((r) => this.parseMetadata<Entity>(r));
    } catch (err) {
      logger.error('Failed to search entities', err);
      throw new AppError('Failed to search entities', 'DB_ERROR', err);
    }
  }

  // --- Claims ---
  async createClaim(claim: Omit<Claim, 'id' | 'created_at' | 'updated_at'>): Promise<Claim> {
    try {
      const { entity_id, statement, evidence, confidence, source } = claim;
      const result = await this.db.exec({
        sql: `INSERT INTO claims (entity_id, statement, evidence, confidence, source)
              VALUES (?, ?, ?, ?, ?) RETURNING *`,
        bind: [entity_id, statement, evidence ?? null, confidence, source ?? null],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Claim[];
      return result[0];
    } catch (err) {
      logger.error('Failed to create claim', err);
      throw new AppError('Failed to create claim', 'DB_ERROR', err);
    }
  }

  async getClaimsByEntityId(entity_id: string): Promise<Claim[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM claims WHERE entity_id = ? ORDER BY created_at DESC`,
        bind: [entity_id],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Claim[];
      return results;
    } catch (err) {
      logger.error('Failed to fetch claims', err);
      throw new AppError('Failed to fetch claims', 'DB_ERROR', err);
    }
  }

  // --- Notes ---
  async createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    try {
      const { entity_id, content, format } = note;
      const result = await this.db.exec({
        sql: `INSERT INTO notes (entity_id, content, format)
              VALUES (?, ?, ?) RETURNING *`,
        bind: [entity_id ?? null, content, format],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Note[];
      return result[0];
    } catch (err) {
      logger.error('Failed to create note', err);
      throw new AppError('Failed to create note', 'DB_ERROR', err);
    }
  }

  async getNotesByEntityId(entity_id: string): Promise<Note[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM notes WHERE entity_id = ? ORDER BY created_at DESC`,
        bind: [entity_id],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Note[];
      return results;
    } catch (err) {
      logger.error('Failed to fetch notes', err);
      throw new AppError('Failed to fetch notes', 'DB_ERROR', err);
    }
  }

  // --- Links ---
  async createLink(link: Omit<Link, 'id' | 'created_at' | 'updated_at'>): Promise<Link> {
    try {
      const { source_id, target_id, relation, metadata } = link;
      const result = await this.db.exec({
        sql: `INSERT INTO links (source_id, target_id, relation, metadata)
              VALUES (?, ?, ?, ?) RETURNING *`,
        bind: [source_id, target_id, relation, metadata ? JSON.stringify(metadata) : null],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Record<string, unknown>[];
      return this.parseMetadata<Link>(result[0]);
    } catch (err) {
      logger.error('Failed to create link', err);
      throw new AppError('Failed to create link', 'DB_ERROR', err);
    }
  }

  async getAllLinks(): Promise<Link[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM links`,
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Record<string, unknown>[];
      return results.map((r) => this.parseMetadata<Link>(r));
    } catch (err) {
      logger.error('Failed to fetch links', err);
      throw new AppError('Failed to fetch links', 'DB_ERROR', err);
    }
  }

  private parseMetadata<T extends { metadata?: Record<string, unknown> }>(row: unknown): T {
    const r = row as T & { metadata?: string | Record<string, unknown> };
    if (r && typeof r.metadata === 'string') {
      try {
        r.metadata = JSON.parse(r.metadata) as Record<string, unknown>;
      } catch {
        r.metadata = {};
      }
    }
    return r as T;
  }
}

export const repository = new Repository();
