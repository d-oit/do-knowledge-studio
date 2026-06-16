/**
 * Markdown round-trip import/export.
 *
 * Uses gray-matter to read/write frontmatter so that exported Markdown
 * can be re-imported losslessly. See ADR-010 and plan 040 action B5/B6.
 */
import matter from 'gray-matter';
import type { Entity, Note } from './validation';
import { sanitizeHtml } from './security';

export interface MarkdownNoteFrontmatter {
  id?: string;
  entityId?: string | null;
  title?: string;
  tags?: string[];
  format?: 'markdown' | 'plain';
  createdAt?: string;
  updatedAt?: string;
}

export interface MarkdownNoteFile {
  filename: string;
  raw: string;
  frontmatter: MarkdownNoteFrontmatter;
  body: string;
}

const DEFAULT_EXTENSION = '.md';

function normalizeFilename(name: string): string {
  return name.endsWith(DEFAULT_EXTENSION) ? name : `${name}${DEFAULT_EXTENSION}`;
}

export function importMarkdownNote(raw: string, filename = 'note.md'): MarkdownNoteFile {
  const parsed = matter(raw);
  const fm = parsed.data as MarkdownNoteFrontmatter;
  return {
    filename: normalizeFilename(filename),
    raw,
    frontmatter: fm,
    body: parsed.content,
  };
}

export interface ImportMarkdownFilesResult {
  notes: Array<Pick<Note, 'content' | 'format'> & { entityId: string | null; title?: string; tags?: string[] }>;
  errors: Array<{ file: string; error: string }>;
}

export function importMarkdownFiles(
  files: Array<{ name: string; content: string }>,
): ImportMarkdownFilesResult {
  const notes: ImportMarkdownFilesResult['notes'] = [];
  const errors: ImportMarkdownFilesResult['errors'] = [];
  for (const file of files) {
    try {
      const parsed = importMarkdownNote(file.content, file.name);
      notes.push({
        content: parsed.body.trim(),
        format: parsed.frontmatter.format ?? 'markdown',
        entityId: parsed.frontmatter.entityId ?? null,
        title: parsed.frontmatter.title,
        tags: parsed.frontmatter.tags,
      });
    } catch (err) {
      errors.push({
        file: file.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { notes, errors };
}

export function exportNoteToMarkdown(note: Note, opts?: { entityName?: string }): string {
  const fm: MarkdownNoteFrontmatter = {
    id: note.id,
    entityId: note.entity_id ?? null,
    title: opts?.entityName,
    format: note.format,
  };
  if (note.created_at) fm.createdAt = note.created_at;
  if (note.updated_at) fm.updatedAt = note.updated_at;
  const body = note.content ?? '';
  return matter.stringify(body, fm);
}

export function exportEntityToMarkdown(
  entity: Entity,
  notes: Note[] = [],
): string {
  const lines: string[] = [];
  lines.push(`# ${entity.name}`);
  lines.push('');
  lines.push(`**Type:** ${entity.type}`);
  if (entity.description) {
    lines.push('');
    lines.push(sanitizeHtml(entity.description));
  }
  if (notes.length > 0) {
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    for (const note of notes) {
      lines.push(sanitizeHtml(note.content));
      lines.push('');
    }
  }
  const fm = {
    id: entity.id,
    type: entity.type,
    ...(entity.sourceUrl ? { sourceUrl: entity.sourceUrl } : {}),
  };
  return matter.stringify(lines.join('\n'), fm);
}
