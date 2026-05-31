import { z } from 'zod';
import { Note, NoteSchema } from '../../lib/validation';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { perf } from '../../lib/perf';
import { RepositoryBase } from './base';

export async function createNote(base: RepositoryBase, note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
  try {
    const validated = NoteSchema.omit({ id: true, created_at: true, updated_at: true }).parse(note);
    const { entity_id, content, format } = validated;
    const result = await base.exec({
      sql: `INSERT INTO notes (entity_id, content, format)
            VALUES (?, ?, ?) RETURNING *`,
      bind: [entity_id ?? null, content, format ?? 'markdown'],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(result);

    return base.parseMetadata(NoteSchema, rows[0]);
  } catch (err) {
    logger.error('Failed to create note', err);
    throw new AppError('Failed to create note', 'DB_ERROR', err);
  }
}

export async function getAllNotes(base: RepositoryBase): Promise<Note[]> {
  perf.mark('sqlite-query');
  try {
    const results = await base.exec({
      sql: `SELECT * FROM notes`,
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);

    return rows.map((r) => base.parseMetadata(NoteSchema, r));
  } catch (err) {
    logger.error('Failed to fetch all notes', err);
    throw new AppError('Failed to fetch all notes', 'DB_ERROR', err);
  } finally {
    perf.measure('sqlite-query-notes', 'sqlite-query');
  }
}

export async function getNotesByEntityId(base: RepositoryBase, entity_id: string): Promise<Note[]> {
  try {
    const results = await base.exec({
      sql: `SELECT * FROM notes WHERE entity_id = ? ORDER BY created_at DESC`,
      bind: [entity_id],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);

    return rows.map((r) => base.parseMetadata(NoteSchema, r));
  } catch (err) {
    logger.error('Failed to fetch notes', err);
    throw new AppError('Failed to fetch notes', 'DB_ERROR', err);
  }
}

export async function updateNote(base: RepositoryBase, id: string, note: Partial<Note>): Promise<Note> {
  try {
    const results = await base.exec({
      sql: `SELECT * FROM notes WHERE id = ?`,
      bind: [id],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);
    if (rows.length === 0) throw new AppError('Note not found', 'NOT_FOUND');

    const validated = NoteSchema.partial().parse(note);

    const current = base.parseMetadata(NoteSchema, rows[0]);
    const content = validated.content ?? current.content;
    const format = validated.format ?? current.format;

    const result = await base.exec({
      sql: `UPDATE notes SET content = ?, format = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
      bind: [content, format, id],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const resultRows = z.array(z.unknown()).parse(result);

    return base.parseMetadata(NoteSchema, resultRows[0]);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('Failed to update note', err);
    throw new AppError('Failed to update note', 'DB_ERROR', err);
  }
}

export async function deleteNote(base: RepositoryBase, id: string): Promise<void> {
  try {
    await base.exec({
      sql: `DELETE FROM notes WHERE id = ?`,
      bind: [id],
    });
  } catch (err) {
    logger.error('Failed to delete note', err);
    throw new AppError('Failed to delete note', 'DB_ERROR', err);
  }
}
