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
import { perf } from '../lib/perf';

/** Schema for search-related query results that join entities and links. */
const SearchRelatedRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().nullable().optional(),
  relation: z.string(),
  source_id: z.string(),
  target_id: z.string(),
});

export interface RankedResult {
  id: string;
  title: string;
  type: string;
  content: string;
  score: number;
  stage: string;
}

/** Result of diffing two graph snapshots, showing added/removed nodes and edges. */
export interface GraphSnapshotDiff {
  added_nodes: string[];
  removed_nodes: string[];
  added_edges: string[];
  removed_edges: string[];
}

/**
 * Data access layer for all persisted entity types.
 * Provides CRUD operations for entities, claims, notes, links, and graph snapshots.
 * All methods validate input with Zod schemas and throw AppError on failure.
 */
export class Repository {
  private get db(): SQLiteDB {
    return getDb();
  }

  // --- Entities ---
  /**
   * Create a new entity.
   * @param entity - Name, type, optional description and metadata.
   * @returns The created entity with generated id and rowid.
   */
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
      const row = rows[0] as Record<string, unknown>;
      return { ...parsed, rowid: row.rowid as number };
    } catch (err) {
      logger.error('Failed to create entity', err);
      throw new AppError('Failed to create entity', 'DB_ERROR', err);
    }
  }

  /** Execute a raw SQL statement against the database. */
  async exec(options: Parameters<SQLiteDB['exec']>[0]): Promise<unknown> {
    return this.db.exec(options);
  }

  /** Execute multiple statements in a single transaction. */
  async transaction(statements: Parameters<SQLiteDB['transaction']>[0]): Promise<unknown> {
    return this.db.transaction(statements);
  }

  /**
   * Get entities, ordered by name.
   * Supports optional cursor-based pagination via limit/offset.
   * @param options - Optional limit and offset for pagination.
   */
  async getAllEntities(options?: { limit?: number; offset?: number }): Promise<Entity[]> {
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
      const results = await this.db.exec({
        sql,
        bind: bind.length > 0 ? bind : undefined,
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => this.parseMetadata(EntitySchema, r));
    } catch (err) {
      logger.error('Failed to fetch entities', err);
      throw new AppError('Failed to fetch entities', 'DB_ERROR', err);
    } finally {
      perf.measure('sqlite-query-entities', 'sqlite-query');
    }
  }

  /**
   * Get a single entity by its UUID.
   * @returns The entity with rowid, or null if not found.
   */
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
      return { ...parsed, rowid: (rows[0] as { rowid: number }).rowid };
    } catch (err) {
      logger.error('Failed to fetch entity by id', err);
      throw new AppError('Failed to fetch entity by id', 'DB_ERROR', err);
    }
  }

  /**
   * Find an entity by its unique name.
   * @returns The entity or null if not found.
   */
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

  /**
   * Update an existing entity's fields.
   * @returns The updated entity.
   * @throws {AppError} If the entity is not found.
   */
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

  /** Delete an entity and cascade to its claims, links, and notes. */
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

  /**
   * Full-text search entities via FTS5 with LIKE fallback.
   * @param query - Search term.
   * @returns Matching entities ordered by relevance.
   */
  async searchEntities(query: string): Promise<Entity[]> {
    try {
      perf.mark('sqlite-query');
      // Use FTS5 for search with prefix matching to reduce LIKE fallback
      const ftsQuery = query.trim().replace(/[^\w\s-]/g, '').split(/\s+/).filter(Boolean).map(t => `${t}*`).join(' ');
      const results = await this.db.exec({
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
        const fallback = await this.db.exec({
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
        return fallbackRows.map((r) => this.parseMetadata(EntitySchema, r));
      }

      perf.measure('sqlite-query-search-fts', 'sqlite-query');
      return resultRows.map((r) => this.parseMetadata(EntitySchema, r));
    } catch (err) {
      logger.error('Failed to search entities', err);
      throw new AppError('Failed to search entities', 'DB_ERROR', err);
    }
  }

  async searchRelated(query: string, options?: { excludeIds?: Set<string> }): Promise<RankedResult[]> {
    try {
      perf.mark('sqlite-query');
      const ftsQuery = query.trim().replace(/[^\w\s-]/g, '').split(/\s+/).filter(Boolean).map(t => `${t}*`).join(' ');
      const results = await this.db.exec({
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

  // --- Claims ---
  /**
   * Create a new claim for an entity.
   * @param claim - entity_id, statement, optional evidence, confidence, source, verification_status.
   * @returns The created claim with generated id and rowid.
   */
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
      return { ...parsed, rowid: (rows[0] as { rowid: number }).rowid };
    } catch (err) {
      logger.error('Failed to create claim', err);
      throw new AppError('Failed to create claim', 'DB_ERROR', err);
    }
  }

  /**
   * Create a claim with provenance tracking.
   * Alias for createClaim that emphasizes source/verification fields.
   * @returns The created claim.
   */
  async createClaimWithProvenance(
    claim: Omit<Claim, 'id' | 'created_at' | 'updated_at' | 'verification_status'> & {
      verification_status?: Claim['verification_status'];
    },
  ): Promise<Claim> {
    return this.createClaim(claim);
  }

  /**
   * Get all claims filtered by verification status.
   * @param status - 'unverified', 'verified', or 'disputed'.
   */
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

  /**
   * Batch-lookup verification statuses for multiple claims.
   * Returns a Map of claimId → verification_status for efficient result enrichment.
   * @param claimIds - Array of claim UUIDs to look up.
   * @returns Map from claim ID to its verification_status value.
   */
  async getClaimStageMap(claimIds: string[]): Promise<Map<string, string>> {
    if (claimIds.length === 0) return new Map();
    try {
      const placeholders = claimIds.map(() => '?').join(',');
      const results = await this.db.exec({
        sql: `SELECT id, verification_status FROM claims WHERE id IN (${placeholders})`,
        bind: claimIds,
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.object({ id: z.string(), verification_status: z.string() })).parse(results);
      return new Map(rows.map(r => [r.id, r.verification_status]));
    } catch (err) {
      logger.error('Failed to batch-lookup claim stages', err);
      return new Map();
    }
  }

  /**
   * Update a claim's verification status only.
   * @returns The updated claim.
   * @throws {AppError} If the claim is not found.
   */
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

  /**
   * Get all claims belonging to an entity, ordered by creation date descending.
   * @returns Claims with rowid for FTS5 index maintenance.
   */
  async getClaimsByEntityId(entity_id: string): Promise<(Claim & { rowid: number })[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT *, rowid FROM claims WHERE entity_id = ? ORDER BY created_at DESC`,
        bind: [entity_id],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => {
        const row = r as Record<string, unknown>;
        return { ...this.parseMetadata(ClaimSchema, r), rowid: row.rowid as number };
      });
    } catch (err) {
      logger.error('Failed to fetch claims', err);
      throw new AppError('Failed to fetch claims', 'DB_ERROR', err);
    }
  }

  /** Get all notes in the database. */
  async getAllNotes(): Promise<Note[]> {
    perf.mark('sqlite-query');
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM notes`,
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => this.parseMetadata(NoteSchema, r));
    } catch (err) {
      logger.error('Failed to fetch all notes', err);
      throw new AppError('Failed to fetch all notes', 'DB_ERROR', err);
    } finally {
      perf.measure('sqlite-query-notes', 'sqlite-query');
    }
  }

  /** Get all claims in the database. */
  async getAllClaims(): Promise<Claim[]> {
    perf.mark('sqlite-query');
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
    } finally {
      perf.measure('sqlite-query-claims', 'sqlite-query');
    }
  }

  /**
   * Get all claims grouped by entity_id for batch export.
   * More efficient than N+1 queries for export operations.
   */
  async getAllClaimsGroupedByEntity(): Promise<Record<string, Claim[]>> {
    const claims = await this.getAllClaims();
    return claims.reduce((acc, claim) => {
      if (!acc[claim.entity_id]) acc[claim.entity_id] = [];
      acc[claim.entity_id].push(claim);
      return acc;
    }, {} as Record<string, Claim[]>);
  }

  /**
   * Batch-load entities with their claims in a single query via LEFT JOIN.
   * Eliminates N+1 round-trips when both entities and claims are needed.
   * @returns Entities keyed by id, each with a claims array.
   */
  async getAllEntitiesWithClaims(): Promise<Map<string, { entity: Entity; claims: Claim[] }>> {
    perf.mark('sqlite-query');
    try {
      const results = await this.db.exec({
        sql: `SELECT e.*, c.id as c_id, c.entity_id as c_entity_id, c.statement as c_statement,
                     c.evidence as c_evidence, c.confidence as c_confidence, c.source as c_source,
                     c.verification_status as c_verification_status, c.created_at as c_created_at,
                     c.updated_at as c_updated_at
              FROM entities e
              LEFT JOIN claims c ON e.id = c.entity_id
              ORDER BY e.name ASC`,
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);

      const result = new Map<string, { entity: Entity; claims: Claim[] }>();
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const entityId = String(r.id);

        if (!result.has(entityId)) {
          result.set(entityId, {
            entity: this.parseMetadata(EntitySchema, row),
            claims: [],
          });
        }

        if (r.c_id !== null) {
          const claimRow: Record<string, unknown> = {
            id: r.c_id,
            entity_id: r.c_entity_id,
            statement: r.c_statement,
            evidence: r.c_evidence,
            confidence: r.c_confidence,
            source: r.c_source,
            verification_status: r.c_verification_status,
            created_at: r.c_created_at,
            updated_at: r.c_updated_at,
          };
          const entry = result.get(entityId);
          if (entry) {
            entry.claims.push(this.parseMetadata(ClaimSchema, claimRow));
          }
        }
      }

      perf.measure('sqlite-query-entities-claims', 'sqlite-query');
      return result;
    } catch (err) {
      logger.error('Failed to batch-load entities with claims', err);
      throw new AppError('Failed to batch-load entities with claims', 'DB_ERROR', err);
    }
  }

  /**
   * Get all notes grouped by entity_id for batch export.
   */
  async getAllNotesGroupedByEntity(): Promise<Record<string, Note[]>> {
    const notes = await this.getAllNotes();
    return notes.reduce((acc, note) => {
      if (!note.entity_id) return acc;
      if (!acc[note.entity_id]) acc[note.entity_id] = [];
      acc[note.entity_id].push(note);
      return acc;
    }, {} as Record<string, Note[]>);
  }

  /**
   * Update an existing claim's fields.
   * @returns The updated claim.
   * @throws {AppError} If the claim is not found.
   */
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

  /** Delete a claim by its UUID. */
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
  /**
   * Create a new note.
   * @param note - entity_id (nullable), content, optional format.
   * @returns The created note.
   */
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

  /** Get all notes for an entity, newest first. */
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

  /**
   * Update a note's content and/or format.
   * @returns The updated note.
   * @throws {AppError} If the note is not found.
   */
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

  /** Delete a note by its UUID. */
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
  /**
   * Create a new link (relationship) between two entities.
   * @param link - source_id, target_id, relation, optional metadata.
   * @returns The created link.
   */
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

  /**
   * Get all links in the database.
   * Supports optional cursor-based pagination via limit/offset.
   * @param options - Optional limit and offset for pagination.
   */
  async getAllLinks(options?: { limit?: number; offset?: number }): Promise<Link[]> {
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
      const results = await this.db.exec({
        sql,
        bind: bind.length > 0 ? bind : undefined,
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => this.parseMetadata(LinkSchema, r));
    } catch (err) {
      logger.error('Failed to fetch links', err);
      throw new AppError('Failed to fetch links', 'DB_ERROR', err);
    } finally {
      perf.measure('sqlite-query-links', 'sqlite-query');
    }
  }

  /** Delete a link by its UUID. */
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

  /**
   * Get all entities that link to the given entity (backlinks).
   * @param entityId - The UUID of the target entity.
   * @returns Array of source entities.
   */
  async getBacklinks(entityId: string): Promise<Entity[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT DISTINCT e.* FROM entities e
              JOIN links l ON e.id = l.source_id
              WHERE l.target_id = ?
              ORDER BY e.name ASC`,
        bind: [entityId],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map((r) => this.parseMetadata(EntitySchema, r));
    } catch (err) {
      logger.error('Failed to fetch backlinks', err);
      throw new AppError('Failed to fetch backlinks', 'DB_ERROR', err);
    }
  }

  /**
   * Get the total count of backlinks for an entity.
   * @param entityId - The UUID of the target entity.
   */
  async getBacklinkCount(entityId: string): Promise<number> {
    try {
      const results = await this.db.exec({
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

  // --- Web Cache ---
  /**
   * Cache resolved web content for offline use.
   * @param url - The source URL (primary key).
   * @param content - The resolved markdown/plain text content.
   * @param title - Optional page title.
   * @param format - 'markdown' or 'plain'.
   */
  async upsertWebCache(url: string, content: string, title?: string, format: 'markdown' | 'plain' = 'plain'): Promise<void> {
    try {
      await this.db.exec({
        sql: `INSERT OR REPLACE INTO web_cache (url, content, format, title, resolved_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        bind: [url, content, format, title ?? null],
      });
    } catch (err) {
      logger.error('Failed to upsert web cache', err);
      throw new AppError('Failed to upsert web cache', 'DB_ERROR', err);
    }
  }

  /**
   * Retrieve cached web content by URL.
   * @returns The cached row or null if not found.
   * @throws {AppError} If the database query fails.
   */
  async getWebCache(url: string): Promise<{ url: string; content: string; format: string; title?: string; resolved_at: string } | null> {
    try {
      const results = await this.db.exec({
        sql: `SELECT url, content, format, title, resolved_at FROM web_cache WHERE url = ?`,
        bind: [url],
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      if (rows.length === 0) return null;
      const r = rows[0] as Record<string, unknown>;
      return {
        url: String(r.url),
        content: String(r.content),
        format: String(r.format),
        title: typeof r.title === 'string' ? r.title : undefined,
        resolved_at: String(r.resolved_at),
      };
    } catch (err) {
      logger.error('Failed to get web cache', err);
      throw new AppError('Failed to get web cache', 'DB_ERROR', err);
    }
  }

  // --- Graph Snapshots ---
  /**
   * Save a snapshot of the current graph state.
   * @param name - Human-readable snapshot name.
   * @param nodes - Array of graph nodes with id and label.
   * @param edges - Array of graph edges with id, source, target, and optional label.
   * @param description - Optional description of this snapshot.
   * @returns The created graph snapshot.
   */
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

  /**
   * Retrieve a graph snapshot by its UUID.
   * @returns The snapshot or null if not found.
   */
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

  /** List all graph snapshots, newest first (summary only, no JSON payloads). */
  async listSnapshots(): Promise<GraphSnapshot[]> {
    try {
      const results = await this.db.exec({
        sql: `SELECT * FROM graph_snapshots ORDER BY created_at DESC`,
        returnValue: 'resultRows',
        rowMode: 'object',
      });
      const rows = z.array(z.unknown()).parse(results);
      return rows.map(r => this.parseMetadata(GraphSnapshotSchema, r));
    } catch (err) {
      logger.error('Failed to list snapshots', err);
      throw new AppError('Failed to list snapshots', 'DB_ERROR', err);
    }
  }

  /**
   * Compute the diff between two graph snapshots.
   * @param id1 - First snapshot UUID.
   * @param id2 - Second snapshot UUID.
   * @returns Object with arrays of added/removed node IDs and edge IDs.
   * @throws {AppError} If either snapshot is not found.
   */
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

  private parseMetadata<T extends z.ZodType<unknown>>(schema: T, row: unknown): z.infer<T> {
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

/** Singleton repository instance for the application. */
export const repository = new Repository();
