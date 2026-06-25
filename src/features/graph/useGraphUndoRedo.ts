import { useCallback, useRef, useState } from 'react';
import type { IRepository } from '../../db/repository';
import type { Entity } from '../../lib/validation';
import { logger } from '../../lib/logger';

interface UndoEntry {
  entity: Entity;
  claims: { statement: string; source: string; verification_status: string }[];
  links: { source_id: string; target_id: string; relation: string; metadata?: string }[];
}

const MAX_HISTORY = 50;

export function useGraphUndoRedo(repository: IRepository) {
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const pushDelete = useCallback(async (entityId: string) => {
    try {
      const entity = await repository.getEntityById(entityId);
      if (!entity) return;

      const claims = await repository.getClaimsByEntityId(entityId);
      const claimData = claims.map(c => ({
        statement: c.statement,
        source: c.source || 'Manual entry',
        verification_status: c.verification_status,
      }));

      const allLinks = await repository.getAllLinks();
      const linkData = allLinks
        .filter(l => l.source_id === entityId || l.target_id === entityId)
        .map(l => ({
          source_id: l.source_id,
          target_id: l.target_id,
          relation: l.relation,
          metadata: l.metadata ? JSON.stringify(l.metadata) : undefined,
        }));

      undoStack.current.push({ entity, claims: claimData, links: linkData });
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      redoStack.current = [];
      setUndoCount(undoStack.current.length);
      setRedoCount(0);
    } catch (err) {
      logger.error('Failed to capture undo state', err);
    }
  }, [repository]);

  const undo = useCallback(async (): Promise<boolean> => {
    const entry = undoStack.current.pop();
    if (!entry) return false;

    try {
      const { entity, claims, links } = entry;
      const statements: { sql: string; bind?: (string | number | boolean | null)[] }[] = [];

      statements.push({
        sql: 'INSERT INTO entities (id, name, type, description, source_url, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        bind: [entity.id, entity.name, entity.type, entity.description || '', entity.sourceUrl || null, JSON.stringify(entity.metadata || {}), entity.created_at || new Date().toISOString(), entity.updated_at || new Date().toISOString()]
      });

      for (const claim of claims) {
        statements.push({
          sql: 'INSERT INTO claims (entity_id, statement, confidence, evidence, source, verification_status) VALUES (?, ?, ?, ?, ?, ?)',
          bind: [entity.id, claim.statement, 1.0, 'Restored from undo', claim.source, claim.verification_status]
        });
      }

      for (const link of links) {
        statements.push({
          sql: 'INSERT INTO links (source_id, target_id, relation, metadata) VALUES (?, ?, ?, ?)',
          bind: [link.source_id, link.target_id, link.relation, link.metadata || null]
        });
      }

      await repository.transaction(statements);
      redoStack.current.push(entry);
      setUndoCount(undoStack.current.length);
      setRedoCount(redoStack.current.length);
      logger.info('Undone entity deletion', { entityId: entity.id });
      return true;
    } catch (err) {
      logger.error('Undo failed', err);
      undoStack.current.push(entry);
      setUndoCount(undoStack.current.length);
      return false;
    }
  }, [repository]);

  const redo = useCallback(async (): Promise<boolean> => {
    const entry = redoStack.current.pop();
    if (!entry) return false;

    try {
      await repository.deleteEntity(entry.entity.id);
      undoStack.current.push(entry);
      setUndoCount(undoStack.current.length);
      setRedoCount(redoStack.current.length);
      logger.info('Redone entity deletion', { entityId: entry.entity.id });
      return true;
    } catch (err) {
      logger.error('Redo failed', err);
      redoStack.current.push(entry);
      setRedoCount(redoStack.current.length);
      return false;
    }
  }, [repository]);

  return {
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    undoCount,
    redoCount,
    pushDelete,
    undo,
    redo,
  };
}
