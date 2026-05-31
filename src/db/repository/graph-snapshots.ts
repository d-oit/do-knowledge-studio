import { z } from 'zod';
import { GraphSnapshot, GraphSnapshotSchema } from '../../lib/validation';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { RepositoryBase } from './base';
import { GraphSnapshotDiff } from './types';

export async function createSnapshot(
  base: RepositoryBase,
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

    const result = await base.exec({
      sql: `INSERT INTO graph_snapshots (name, nodes_json, edges_json, description)
            VALUES (?, ?, ?, ?) RETURNING *`,
      bind: [validated.name, validated.nodes_json, validated.edges_json, validated.description ?? null],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(result);

    return base.parseMetadata(GraphSnapshotSchema, rows[0]);
  } catch (err) {
    logger.error('Failed to create snapshot', err);
    throw new AppError('Failed to create snapshot', 'DB_ERROR', err);
  }
}

export async function getSnapshot(base: RepositoryBase, id: string): Promise<GraphSnapshot | null> {
  try {
    const results = await base.exec({
      sql: `SELECT * FROM graph_snapshots WHERE id = ?`,
      bind: [id],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);
    if (rows.length === 0) return null;

    return base.parseMetadata(GraphSnapshotSchema, rows[0]);
  } catch (err) {
    logger.error('Failed to fetch snapshot', err);
    throw new AppError('Failed to fetch snapshot', 'DB_ERROR', err);
  }
}

export async function listSnapshots(base: RepositoryBase): Promise<GraphSnapshot[]> {
  try {
    const results = await base.exec({
      sql: `SELECT * FROM graph_snapshots ORDER BY created_at DESC`,
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);

    return rows.map(r => base.parseMetadata(GraphSnapshotSchema, r));
  } catch (err) {
    logger.error('Failed to list snapshots', err);
    throw new AppError('Failed to list snapshots', 'DB_ERROR', err);
  }
}

export async function diffSnapshots(base: RepositoryBase, id1: string, id2: string): Promise<GraphSnapshotDiff> {
  try {
    const [snap1, snap2] = await Promise.all([getSnapshot(base, id1), getSnapshot(base, id2)]);
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
