import { getDb, SQLiteDB } from './client';
import { Entity, Claim, Note, Link, GraphSnapshot } from '../lib/validation';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export interface GraphSnapshotDiff {
  added_nodes: string[];
  removed_nodes: string[];
  added_edges: string[];
  removed_edges: string[];
}

export class Repository {
  private get db(): SQLiteDB {
    return getDb();
  }

  // --- Entities ---
  async createEntity(entity: Omit<Entity, 'id' | 'created_at' | 'updated_at'>): Promise<Entity> {
    try {
      const { name, type, description, metadata, embedding } = entity;
      const result = await this.db.exec({
        sql: `INSERT INTO entities (name, type, description, metadata, embedding)
              VALUES (?, ?, ?, ?, ?) RETURNING *`,
        bind: [
          name,
          type,
          description ?? null,
          metadata ? JSON.stringify(metadata) : null,
          embedding ? JSON.stringify(embedding) : null
        ],
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
  async createClaim(
    claim: Omit<Claim, 'id' | 'created_at' | 'updated_at' | 'verification_status'> & {
      verification_status?: Claim['verification_status'];
    },
  ): Promise<Claim> {
    try {
      const { entity_id, statement, evidence, confidence, source, verification_status, embedding } = claim;
      const result = await this.db.exec({
        sql: `INSERT INTO claims (entity_id, statement, evidence, confidence, source, verification_status, embedding)
              VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        bind: [
          entity_id,
          statement,
          evidence ?? null,
          confidence,
          source ?? null,
          verification_status ?? 'unverified',
          embedding ? JSON.stringify(embedding) : null
        ],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as (Claim & { embedding: string })[];
      return this.parseEmbedding(result[0]);
    } catch (err) {
      logger.error('Failed to create claim', err);
      throw new AppError('Failed to create claim', 'DB_ERROR', err);
    }
  }

  async createClaimWithProvenance(
    claim: Omit<Claim, 'id' | 'created_at' | 'updated_at' | 'verification_status'> & {
      verification_status?: Claim['verification_status'];
    },
  ): Promise<Claim> {
    try {
      const { entity_id, statement, evidence, confidence, source, verification_status } = claim;
      const result = await this.db.exec({
        sql: `INSERT INTO claims (entity_id, statement, evidence, confidence, source, verification_status)
              VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
        bind: [
          entity_id,
          statement,
          evidence ?? null,
          confidence ?? 1,
          source ?? null,
          verification_status ?? 'unverified',
        ],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Claim[];
      return result[0];
    } catch (err) {
      logger.error('Failed to create claim with provenance', err);
      throw new AppError('Failed to create claim with provenance', 'DB_ERROR', err);
    }
  }

  async getClaimsByVerificationStatus(status: Claim['verification_status']): Promise<Claim[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM claims WHERE verification_status = ? ORDER BY created_at DESC`,
        bind: [status],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Claim[];
      return results;
    } catch (err) {
      logger.error('Failed to fetch claims by verification status', err);
      throw new AppError('Failed to fetch claims by verification status', 'DB_ERROR', err);
    }
  }

  async updateClaimVerification(
    claimId: string,
    verification_status: Claim['verification_status'],
  ): Promise<Claim> {
    try {
      const result = await this.db.exec({
        sql: `UPDATE claims SET verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
        bind: [verification_status, claimId],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Claim[];
      if (result.length === 0) {
        throw new AppError('Claim not found', 'NOT_FOUND', null);
      }
      return result[0];
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Failed to update claim verification', err);
      throw new AppError('Failed to update claim verification', 'DB_ERROR', err);
    }
  }

  async updateEntityEmbedding(id: string, embedding: number[]): Promise<void> {
    try {
      await this.db.exec({
        sql: `UPDATE entities SET embedding = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        bind: [JSON.stringify(embedding), id],
      });
    } catch (err) {
      logger.error('Failed to update entity embedding', err);
    }
  }

  async updateClaimEmbedding(id: string, embedding: number[]): Promise<void> {
    try {
      await this.db.exec({
        sql: `UPDATE claims SET embedding = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        bind: [JSON.stringify(embedding), id],
      });
    } catch (err) {
      logger.error('Failed to update claim embedding', err);
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

  async getLinksByBlockId(blockId: string): Promise<Link[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM links WHERE json_extract(metadata, '$.block_id') = ?`,
        bind: [blockId],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as Record<string, unknown>[];
      return results.map((r) => this.parseMetadata<Link>(r));
    } catch (err) {
      logger.error('Failed to fetch links by block id', err);
      throw new AppError('Failed to fetch links by block id', 'DB_ERROR', err);
    }
  }

  // --- Graph Snapshots ---
  async createSnapshot(
    name: string,
    nodes: { id: string; label: string }[],
    edges: { id: string; source: string; target: string; label?: string }[],
    description?: string,
  ): Promise<GraphSnapshot> {
    try {
      const result = await this.db.exec({
        sql: `INSERT INTO graph_snapshots (name, nodes_json, edges_json, description)
              VALUES (?, ?, ?, ?) RETURNING *`,
        bind: [name, JSON.stringify(nodes), JSON.stringify(edges), description ?? null],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as GraphSnapshot[];
      return result[0];
    } catch (err) {
      logger.error('Failed to create snapshot', err);
      throw new AppError('Failed to create snapshot', 'DB_ERROR', err);
    }
  }

  async getSnapshot(id: string): Promise<GraphSnapshot | null> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM graph_snapshots WHERE id = ?`,
        bind: [id],
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as GraphSnapshot[];
      if (results.length === 0) return null;
      return results[0];
    } catch (err) {
      logger.error('Failed to fetch snapshot', err);
      throw new AppError('Failed to fetch snapshot', 'DB_ERROR', err);
    }
  }

  async listSnapshots(): Promise<GraphSnapshot[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT id, name, description, created_at FROM graph_snapshots ORDER BY created_at DESC`,
        returnValue: 'resultRows',
        rowMode: 'object',
      }) as GraphSnapshot[];
      return results;
    } catch (err) {
      logger.error('Failed to list snapshots', err);
      throw new AppError('Failed to list snapshots', 'DB_ERROR', err);
    }
  }

  async diffSnapshots(id1: string, id2: string): Promise<GraphSnapshotDiff> {
    try {
      const [snap1, snap2] = await Promise.all([this.getSnapshot(id1), this.getSnapshot(id2)]);
      if (!snap1 || !snap2) {
        throw new AppError('Snapshot not found', 'NOT_FOUND');
      }

      const nodes1 = JSON.parse(snap1.nodes_json) as { id: string }[];
      const nodes2 = JSON.parse(snap2.nodes_json) as { id: string }[];
      const edges1 = JSON.parse(snap1.edges_json) as { id: string }[];
      const edges2 = JSON.parse(snap2.edges_json) as { id: string }[];

      const ids1 = new Set(nodes1.map((n) => n.id));
      const ids2 = new Set(nodes2.map((n) => n.id));
      const edgeIds1 = new Set(edges1.map((e) => e.id));
      const edgeIds2 = new Set(edges2.map((e) => e.id));

      return {
        added_nodes: [...ids2].filter((id) => !ids1.has(id)),
        removed_nodes: [...ids1].filter((id) => !ids2.has(id)),
        added_edges: [...edgeIds2].filter((id) => !edgeIds1.has(id)),
        removed_edges: [...edgeIds1].filter((id) => !edgeIds2.has(id)),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Failed to diff snapshots', err);
      throw new AppError('Failed to diff snapshots', 'DB_ERROR', err);
    }
  }

  private parseMetadata<T extends { metadata?: Record<string, unknown>; embedding?: any }>(row: unknown): T {
    let r = row as any;
    if (r && typeof r.metadata === 'string') {
      try {
        r.metadata = JSON.parse(r.metadata) as Record<string, unknown>;
      } catch {
        r.metadata = {};
      }
    }
    if (r && typeof r.embedding === 'string') {
      try {
        r.embedding = JSON.parse(r.embedding);
      } catch {
        r.embedding = undefined;
      }
    }
    return r as T;
  }

  private parseEmbedding<T extends { embedding?: any }>(row: T & { embedding?: string }): T {
    if (row && typeof row.embedding === 'string') {
        try {
            row.embedding = JSON.parse(row.embedding);
        } catch {
            row.embedding = undefined;
        }
    }
    return row;
  }
}

export const repository = new Repository();
