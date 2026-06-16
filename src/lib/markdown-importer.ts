/**
 * Markdown round-trip import/export.
 *
 * Implements a small YAML frontmatter parser inline so we don't depend on
 * gray-matter (which transitively requires the vulnerable js-yaml <4.2).
 * The parser handles the subset of YAML we need: flat key:value with strings,
 * arrays (`[a, b, c]`), nulls, booleans, numbers, and ISO timestamps.
 * See ADR-010 and plan 040 action B5/B6.
 */
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
  [key: string]: unknown;
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

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function coerceScalar(value: string): string | number | boolean | null {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '~' || trimmed.toLowerCase() === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function parseFrontmatterYaml(yaml: string): MarkdownNoteFrontmatter {
  const out: MarkdownNoteFrontmatter = {};
  const lines = yaml.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const raw = match[2] ?? '';
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const inner = raw.slice(1, -1).trim();
      if (inner === '') {
        out[key] = [];
      } else {
        out[key] = inner.split(',').map(s => coerceScalar(s));
      }
    } else {
      out[key] = coerceScalar(raw);
    }
  }
  return out;
}

function dumpFrontmatter(fm: MarkdownNoteFrontmatter): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      const items = value.map(v => (typeof v === 'string' ? v : JSON.stringify(v)));
      lines.push(`${key}: [${items.join(', ')}]`);
    } else if (value === null) {
      lines.push(`${key}:`);
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

export function importMarkdownNote(raw: string, filename = 'note.md'): MarkdownNoteFile {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return {
      filename: normalizeFilename(filename),
      raw,
      frontmatter: {},
      body: raw,
    };
  }
  return {
    filename: normalizeFilename(filename),
    raw,
    frontmatter: parseFrontmatterYaml(match[1]),
    body: match[2],
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
  return dumpFrontmatter(fm) + body;
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
  const fm: Record<string, unknown> = {
    id: entity.id,
    type: entity.type,
  };
  if (entity.sourceUrl) fm.sourceUrl = entity.sourceUrl;
  return dumpFrontmatter(fm) + lines.join('\n');
}
