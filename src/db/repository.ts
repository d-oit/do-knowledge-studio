import { z } from 'zod';
import { getDb, SQLiteDB } from './client';
import {
  Entity,
  Claim,
  Note,
  Link,
  GraphSnapshot,
  EntitySchema,
  ClaimSchema,
  NoteSchema,
  LinkSchema,
  GraphSnapshotSchema,
} from '../lib/validation';
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
  async createEntity(entity: Omit<Entity, 'id' | 'created_at' | 'updated_at'>): Promise<Entity & { rowid: number }> {
    try {
      const validated = EntitySchema.omit({ id: true, created_at: true, updated_at: true }).parse(entity);
      const { name, type, description, metadata } = validated;
      const result = await this.db.exec({
        sql: `INSERT INTO entities (name, type, description, metadata)
              VALUES (?, ?, ?, ?) RETURNING *, rowid`,
        bind: [name, type, description ?? null, metadata ? JSON.stringify(metadata) : null],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(result);
      const parsed = this.parseMetadata(EntitySchema, rows[0]);
      return { ...parsed, rowid: (rows[0] as unknown).rowid };
    } catch (err) {
      logger.error('Failed to create entity', err);
      throw new AppError('Failed to create entity', 'DB_ERROR', err);
    }
  }

  async exec(options: Parameters<SQLiteDB['exec']>[0]): Promise<unknown> {
    return this.db.exec(options);
  }

  async transaction(statements: Parameters<SQLiteDB['transaction']>[0]): Promise<unknown> {
    return this.db.transaction(statements);
  }

  async getAllEntities(): Promise<Entity[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM entities ORDER BY name ASC`,
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => this.parseMetadata(EntitySchema, r));
    } catch (err) {
      logger.error('Failed to fetch entities', err);
      throw new AppError('Failed to fetch entities', 'DB_ERROR', err);
    }
  }

  async getEntityById(id: string): Promise<(Entity & { rowid: number }) | null> {
    try {
      const results = await this.db.exec({
        sql: `SELECT *, rowid FROM entities WHERE id = ?`,
        bind: [id],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      if (rows.length === 0) return null;
      const parsed = this.parseMetadata(EntitySchema, rows[0]);
      return { ...parsed, rowid: (rows[0] as any).rowid };
    } catch (err) {
      logger.error('Failed to fetch entity by id', err);
      throw new AppError('Failed to fetch entity by id', 'DB_ERROR', err);
    }
  }

  async getEntityByName(name: string): Promise<Entity | null> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM entities WHERE name = ?`,
        bind: [name],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      if (rows.length === 0) return null;
      return this.parseMetadata(EntitySchema, rows[0]);
    } catch (err) {
      logger.error('Failed to fetch entity by name', err);
      throw new AppError('Failed to fetch entity by name', 'DB_ERROR', err);
    }
  }

  async updateEntity(id: string, entity: Partial<Entity>): Promise<Entity> {
    try {
      const current = await this.getEntityById(id);
      if (!current) throw new AppError('Entity not found', 'NOT_FOUND');

      const validated = EntitySchema.partial().parse(entity);
      const name = validated.name ?? current.name;
      const type = validated.type ?? current.type;
      const description = validated.description ?? current.description;
      const metadata = validated.metadata ?? current.metadata;

      const result = await this.db.exec({
        sql: `UPDATE entities SET name = ?, type = ?, description = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
        bind: [name, type, description ?? null, metadata ? JSON.stringify(metadata) : null, id],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(result);
      return this.parseMetadata(EntitySchema, rows[0]);
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Failed to update entity', err);
      throw new AppError('Failed to update entity', 'DB_ERROR', err);
    }
  }

  async deleteEntity(id: string): Promise<void> {
    try {
      await this.db.exec({
        sql: `DELETE FROM entities WHERE id = ?`,
        bind: [id],
      });
    } catch (err) {
      logger.error('Failed to delete entity', err);
      throw new AppError('Failed to delete entity', 'DB_ERROR', err);
    }
  }

  async searchEntities(query: string): Promise<Entity[]> {
    try {
      // Use FTS5 for search
      const results = await this.db.exec({
        sql: `SELECT DISTINCT e.* FROM entities e
              JOIN entity_search_idx s ON e.rowid = s.rowid
              WHERE entity_search_idx MATCH ?
              ORDER BY rank`,
        bind: [query],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const resultRows = z.array(z.unknown()).parse(results);

      // Fallback to LIKE if FTS5 returns nothing or for simple queries
      if (resultRows.length === 0) {
        const fallback = await this.db.exec({
          sql: `SELECT * FROM entities
                WHERE name LIKE ? OR description LIKE ?
                ORDER BY name ASC`,
          bind: [`%${query}%`, `%${query}%`],
          returnValue: 'resultRows',
          rowMode: 'object',
        });
        const fallbackRows = z.array(z.unknown()).parse(fallback);
        return fallbackRows.map((r) => this.parseMetadata(EntitySchema, r));
      }

      return resultRows.map((r) => this.parseMetadata(EntitySchema, r));
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
  ): Promise<Claim & { rowid: number }> {
    try {
      const validated = ClaimSchema.omit({ id: true, created_at: true, updated_at: true }).parse(claim);
      const { entity_id, statement, evidence, confidence, source, verification_status } = validated;
      const result = await this.db.exec({
        sql: `INSERT INTO claims (entity_id, statement, evidence, confidence, source, verification_status)
              VALUES (?, ?, ?, ?, ?, ?) RETURNING *, rowid`,
        bind: [entity_id, statement, evidence ?? null, confidence ?? 1, source ?? null, verification_status ?? 'unverified'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(result);
      const parsed = this.parseMetadata(ClaimSchema, rows[0]);
      return { ...parsed, rowid: (rows[0] as any).rowid };
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
    return this.createClaim(claim);
  }

  async getClaimsByVerificationStatus(status: Claim['verification_status']): Promise<Claim[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM claims WHERE verification_status = ? ORDER BY created_at DESC`,
        bind: [status],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => this.parseMetadata(ClaimSchema, r));
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
      });
      const rows = z.array(z.unknown()).parse(result);
      if (rows.length === 0) {
        throw new AppError('Claim not found', 'NOT_FOUND', null);
      }
      return this.parseMetadata(ClaimSchema, rows[0]);
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Failed to update claim verification', err);
      throw new AppError('Failed to update claim verification', 'DB_ERROR', err);
    }
  }

  async getClaimsByEntityId(entity_id: string): Promise<(Claim & { rowid: number })[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT *, rowid FROM claims WHERE entity_id = ? ORDER BY created_at DESC`,
        bind: [entity_id],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => ({ ...this.parseMetadata(ClaimSchema, r), rowid: (r as unknown).rowid }));
    } catch (err) {
      logger.error('Failed to fetch claims', err);
      throw new AppError('Failed to fetch claims', 'DB_ERROR', err);
    }
  }

  async getAllClaims(): Promise<Claim[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM claims`,
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => this.parseMetadata(ClaimSchema, r));
    } catch (err) {
      logger.error('Failed to fetch all claims', err);
      throw new AppError('Failed to fetch all claims', 'DB_ERROR', err);
    }
  }

  async updateClaim(id: string, claim: Partial<Claim>): Promise<Claim> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM claims WHERE id = ?`,
        bind: [id],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      if (rows.length === 0) throw new AppError('Claim not found', 'NOT_FOUND');

      const validated = ClaimSchema.partial().parse(claim);
      const current = this.parseMetadata(ClaimSchema, rows[0]);
      const statement = validated.statement ?? current.statement;
      const evidence = validated.evidence ?? current.evidence;
      const confidence = validated.confidence ?? current.confidence;
      const source = validated.source ?? current.source;
      const verification_status = validated.verification_status ?? current.verification_status;

      const result = await this.db.exec({
        sql: `UPDATE claims SET statement = ?, evidence = ?, confidence = ?, source = ?, verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
        bind: [statement, evidence ?? null, confidence, source ?? null, verification_status, id],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const resultRows = z.array(z.unknown()).parse(result);
      return this.parseMetadata(ClaimSchema, resultRows[0]);
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Failed to update claim', err);
      throw new AppError('Failed to update claim', 'DB_ERROR', err);
    }
  }

  async deleteClaim(id: string): Promise<void> {
    try {
      await this.db.exec({
        sql: `DELETE FROM claims WHERE id = ?`,
        bind: [id],
      });
    } catch (err) {
      logger.error('Failed to delete claim', err);
      throw new AppError('Failed to delete claim', 'DB_ERROR', err);
    }
  }

  // --- Notes ---
  async createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    try {
      const validated = NoteSchema.omit({ id: true, created_at: true, updated_at: true }).parse(note);
      const { entity_id, content, format } = validated;
      const result = await this.db.exec({
        sql: `INSERT INTO notes (entity_id, content, format)
              VALUES (?, ?, ?) RETURNING *`,
        bind: [entity_id ?? null, content, format ?? 'markdown'],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(result);
      return this.parseMetadata(NoteSchema, rows[0]);
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
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => this.parseMetadata(NoteSchema, r));
    } catch (err) {
      logger.error('Failed to fetch notes', err);
      throw new AppError('Failed to fetch notes', 'DB_ERROR', err);
    }
  }

  async updateNote(id: string, note: Partial<Note>): Promise<Note> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM notes WHERE id = ?`,
        bind: [id],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      if (rows.length === 0) throw new AppError('Note not found', 'NOT_FOUND');

      const validated = NoteSchema.partial().parse(note);
      const current = this.parseMetadata(NoteSchema, rows[0]);
      const content = validated.content ?? current.content;
      const format = validated.format ?? current.format;

      const result = await this.db.exec({
        sql: `UPDATE notes SET content = ?, format = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
        bind: [content, format, id],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const resultRows = z.array(z.unknown()).parse(result);
      return this.parseMetadata(NoteSchema, resultRows[0]);
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Failed to update note', err);
      throw new AppError('Failed to update note', 'DB_ERROR', err);
    }
  }

  async deleteNote(id: string): Promise<void> {
    try {
      await this.db.exec({
        sql: `DELETE FROM notes WHERE id = ?`,
        bind: [id],
      });
    } catch (err) {
      logger.error('Failed to delete note', err);
      throw new AppError('Failed to delete note', 'DB_ERROR', err);
    }
  }

  // --- Links ---
  async createLink(link: Omit<Link, 'id' | 'created_at' | 'updated_at'>): Promise<Link> {
    try {
      const validated = LinkSchema.omit({ id: true, created_at: true, updated_at: true }).parse(link);
      const { source_id, target_id, relation, metadata } = validated;
      const result = await this.db.exec({
        sql: `INSERT INTO links (source_id, target_id, relation, metadata)
              VALUES (?, ?, ?, ?) RETURNING *`,
        bind: [source_id, target_id, relation, metadata ? JSON.stringify(metadata) : null],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(result);
      return this.parseMetadata(LinkSchema, rows[0]);
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
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => this.parseMetadata(LinkSchema, r));
    } catch (err) {
      logger.error('Failed to fetch links', err);
      throw new AppError('Failed to fetch links', 'DB_ERROR', err);
    }
  }

  async deleteLink(id: string): Promise<void> {
    try {
      await this.db.exec({
        sql: `DELETE FROM links WHERE id = ?`,
        bind: [id],
      });
    } catch (err) {
      logger.error('Failed to delete link', err);
      throw new AppError('Failed to delete link', 'DB_ERROR', err);
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
      const validated = GraphSnapshotSchema.omit({ id: true, created_at: true }).parse({
        name,
        nodes_json: JSON.stringify(nodes),
        edges_json: JSON.stringify(edges),
        description,
      });

      const result = await this.db.exec({
        sql: `INSERT INTO graph_snapshots (name, nodes_json, edges_json, description)
              VALUES (?, ?, ?, ?) RETURNING *`,
        bind: [validated.name, validated.nodes_json, validated.edges_json, validated.description ?? null],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(result);
      return this.parseMetadata(GraphSnapshotSchema, rows[0]);
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
      });
      const rows = z.array(z.unknown()).parse(results);
      if (rows.length === 0) return null;
      return this.parseMetadata(GraphSnapshotSchema, rows[0]);
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
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map(r => r as GraphSnapshot);
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

  private parseMetadata<T extends z.ZodTypeAny>(schema: T, row: unknown): z.infer<T> {
    const r = { ...(row as Record<string, unknown>) };
    if (r && typeof r.metadata === 'string') {
      try {
        r.metadata = JSON.parse(r.metadata) as Record<string, unknown>;
      } catch {
        r.metadata = {};
      }
    }
    // Handle null/missing optional fields for Zod
    if (r.description === null) delete r.description;
    if (r.metadata === null) r.metadata = {};
    if (r.evidence === null) delete r.evidence;
    if (r.source === null) delete r.source;
    
    return schema.parse(r);
  }
}

export const repository = new Repository();
