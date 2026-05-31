import { z } from 'zod';
import { Claim, ClaimSchema, Entity, EntitySchema } from '../../lib/validation';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { perf } from '../../lib/perf';
import { RepositoryBase } from './base';

export async function createClaim(
  base: RepositoryBase,
  claim: Omit<Claim, 'id' | 'created_at' | 'updated_at' | 'verification_status'> & {
    verification_status?: Claim['verification_status'];
  },
): Promise<Claim & { rowid: number }> {
  try {
    const validated = ClaimSchema.omit({ id: true, created_at: true, updated_at: true }).parse(claim);
    const { entity_id, statement, evidence, confidence, source, verification_status } = validated;
    const result = await base.exec({
      sql: `INSERT INTO claims (entity_id, statement, evidence, confidence, source, verification_status)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING *, rowid`,
      bind: [entity_id, statement, evidence ?? null, confidence ?? 1, source ?? null, verification_status ?? 'unverified'],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(result);

    const parsed = base.parseMetadata(ClaimSchema, rows[0]);
    return { ...parsed, rowid: (rows[0] as { rowid: number }).rowid };
  } catch (err) {
    logger.error('Failed to create claim', err);
    throw new AppError('Failed to create claim', 'DB_ERROR', err);
  }
}

export async function getClaimsByVerificationStatus(base: RepositoryBase, status: Claim['verification_status']): Promise<Claim[]> {
  try {
    const results = await base.exec({
      sql: `SELECT * FROM claims WHERE verification_status = ? ORDER BY created_at DESC`,
      bind: [status],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);

    return rows.map((r) => base.parseMetadata(ClaimSchema, r));
  } catch (err) {
    logger.error('Failed to fetch claims by verification status', err);
    throw new AppError('Failed to fetch claims by verification status', 'DB_ERROR', err);
  }
}

export async function getClaimStageMap(base: RepositoryBase, claimIds: string[]): Promise<Map<string, string>> {
  if (claimIds.length === 0) return new Map();
  try {
    const placeholders = claimIds.map(() => '?').join(',');
    const results = await base.exec({
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

export async function updateClaimVerification(
  base: RepositoryBase,
  claimId: string,
  verification_status: Claim['verification_status'],
): Promise<Claim> {
  try {
    const result = await base.exec({
      sql: `UPDATE claims SET verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
      bind: [verification_status, claimId],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(result);
    if (rows.length === 0) {
      throw new AppError('Claim not found', 'NOT_FOUND', null);
    }

    return base.parseMetadata(ClaimSchema, rows[0]);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('Failed to update claim verification', err);
    throw new AppError('Failed to update claim verification', 'DB_ERROR', err);
  }
}

export async function getClaimsByEntityId(base: RepositoryBase, entity_id: string): Promise<(Claim & { rowid: number })[]> {
  try {
    const results = await base.exec({
      sql: `SELECT *, rowid FROM claims WHERE entity_id = ? ORDER BY created_at DESC`,
      bind: [entity_id],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);
    return rows.map((r) => {
      const row = r as Record<string, unknown>;

      return { ...base.parseMetadata(ClaimSchema, r), rowid: row.rowid as number };
    });
  } catch (err) {
    logger.error('Failed to fetch claims', err);
    throw new AppError('Failed to fetch claims', 'DB_ERROR', err);
  }
}

export async function getAllClaims(base: RepositoryBase): Promise<Claim[]> {
  perf.mark('sqlite-query');
  try {
    const results = await base.exec({
      sql: `SELECT * FROM claims`,
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);

    return rows.map((r) => base.parseMetadata(ClaimSchema, r));
  } catch (err) {
    logger.error('Failed to fetch all claims', err);
    throw new AppError('Failed to fetch all claims', 'DB_ERROR', err);
  } finally {
    perf.measure('sqlite-query-claims', 'sqlite-query');
  }
}

export async function getAllEntitiesWithClaims(base: RepositoryBase): Promise<Map<string, { entity: Entity; claims: Claim[] }>> {
  perf.mark('sqlite-query');
  try {
    const results = await base.exec({
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

          entity: base.parseMetadata(EntitySchema, row),
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

          entry.claims.push(base.parseMetadata(ClaimSchema, claimRow));
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

export async function updateClaim(base: RepositoryBase, id: string, claim: Partial<Claim>): Promise<Claim> {
  try {
    const results = await base.exec({
      sql: `SELECT * FROM claims WHERE id = ?`,
      bind: [id],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);
    if (rows.length === 0) throw new AppError('Claim not found', 'NOT_FOUND');

    const validated = ClaimSchema.partial().parse(claim);

    const current = base.parseMetadata(ClaimSchema, rows[0]);
    const statement = validated.statement ?? current.statement;
    const evidence = validated.evidence ?? current.evidence;
    const confidence = validated.confidence ?? current.confidence;
    const source = validated.source ?? current.source;
    const verification_status = validated.verification_status ?? current.verification_status;

    const result = await base.exec({
      sql: `UPDATE claims SET statement = ?, evidence = ?, confidence = ?, source = ?, verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
      bind: [statement, evidence ?? null, confidence, source ?? null, verification_status, id],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const resultRows = z.array(z.unknown()).parse(result);

    return base.parseMetadata(ClaimSchema, resultRows[0]);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('Failed to update claim', err);
    throw new AppError('Failed to update claim', 'DB_ERROR', err);
  }
}

export async function deleteClaim(base: RepositoryBase, id: string): Promise<void> {
  try {
    await base.exec({
      sql: `DELETE FROM claims WHERE id = ?`,
      bind: [id],
    });
  } catch (err) {
    logger.error('Failed to delete claim', err);
    throw new AppError('Failed to delete claim', 'DB_ERROR', err);
  }
}
