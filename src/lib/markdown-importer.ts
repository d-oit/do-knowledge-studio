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
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const INT_RE = /^-?\d+$/;
const FLOAT_RE = /^-?\d+\.\d+$/;
const QUOTE_TRIM_RE = /^['"]|['"]$/g;
const KEY_LINE_RE = /^([A-Za-z_][\w-]*):\s*(.*)$/;

function normalizeFilename(name: string): string {
  return name.endsWith(DEFAULT_EXTENSION) ? name : `${name}${DEFAULT_EXTENSION}`;
}

function isNullishScalar(trimmed: string): boolean {
  return trimmed === '' || trimmed === '~' || trimmed.toLowerCase() === 'null';
}

function isInt(trimmed: string): boolean {
  return INT_RE.test(trimmed);
}

function isFloat(trimmed: string): boolean {
  return FLOAT_RE.test(trimmed);
}

function isBoolean(trimmed: string): boolean {
  return trimmed === 'true' || trimmed === 'false';
}

function isQuotedString(trimmed: string): boolean {
  return trimmed.startsWith('"') || trimmed.startsWith("'");
}

function coerceScalar(value: string): string | number | boolean | null {
  const trimmed = value.trim();
  if (isNullishScalar(trimmed)) return null;
  if (isBoolean(trimmed)) return trimmed === 'true';
  if (isInt(trimmed)) return parseInt(trimmed, 10);
  if (isFloat(trimmed)) return parseFloat(trimmed);
  return isQuotedString(trimmed) ? trimmed.replace(QUOTE_TRIM_RE, '') : trimmed;
}

function coerceArrayLiteral(raw: string): unknown[] {
  const inner = raw.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map(coerceScalar);
}

function parseFrontmatterLine(out: MarkdownNoteFrontmatter, line: string): void {
  if (!line.trim() || line.trim().startsWith('#')) return;
  const match = line.match(KEY_LINE_RE);
  if (!match) return;
  const key = match[1];
  const raw = match[2] ?? '';
  out[key] = raw.startsWith('[') && raw.endsWith(']') ? coerceArrayLiteral(raw) : coerceScalar(raw);
}

function parseFrontmatterYaml(yaml: string): MarkdownNoteFrontmatter {
  const out: MarkdownNoteFrontmatter = {};
  for (const line of yaml.split(/\r?\n/)) {
    parseFrontmatterLine(out, line);
  }
  return out;
}

function formatScalar(value: unknown): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function formatArrayLine(key: string, value: unknown[]): string {
  const items = value.map(formatScalar);
  return `${key}: [${items.join(', ')}]`;
}

function formatValueLine(key: string, value: unknown): string {
  if (value === null) return `${key}:`;
  return `${key}: ${formatScalar(value)}`;
}

function dumpFrontmatter(fm: MarkdownNoteFrontmatter): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined) continue;
    lines.push(Array.isArray(value) ? formatArrayLine(key, value) : formatValueLine(key, value));
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

function parseSingleMarkdownFile(
  file: { name: string; content: string },
  notes: ImportMarkdownFilesResult['notes'],
  errors: ImportMarkdownFilesResult['errors'],
): void {
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

export function importMarkdownFiles(
  files: Array<{ name: string; content: string }>,
): ImportMarkdownFilesResult {
  const notes: ImportMarkdownFilesResult['notes'] = [];
  const errors: ImportMarkdownFilesResult['errors'] = [];
  for (const file of files) {
    parseSingleMarkdownFile(file, notes, errors);
  }
  return { notes, errors };
}

function buildNoteFrontmatter(note: Note, entityName?: string): MarkdownNoteFrontmatter {
  const fm: MarkdownNoteFrontmatter = {
    id: note.id,
    entityId: note.entity_id ?? null,
    title: entityName,
    format: note.format,
  };
  if (note.created_at) fm.createdAt = note.created_at;
  if (note.updated_at) fm.updatedAt = note.updated_at;
  return fm;
}

export function exportNoteToMarkdown(note: Note, opts?: { entityName?: string }): string {
  const fm = buildNoteFrontmatter(note, opts?.entityName);
  const body = note.content ?? '';
  return dumpFrontmatter(fm) + body;
}

function entityToMarkdownLines(entity: Entity, notes: Note[]): string[] {
  const lines: string[] = [];
  lines.push(`# ${entity.name}`);
  lines.push('');
  lines.push(`**Type:** ${entity.type}`);
  if (entity.description) {
    lines.push('', sanitizeHtml(entity.description));
  }
  if (notes.length > 0) {
    lines.push('', '## Notes', '');
    for (const note of notes) {
      lines.push(sanitizeHtml(note.content), '');
    }
  }
  return lines;
}

function buildEntityFrontmatter(entity: Entity): MarkdownNoteFrontmatter {
  const fm: MarkdownNoteFrontmatter = { id: entity.id, type: entity.type };
  if (entity.sourceUrl) fm.sourceUrl = entity.sourceUrl;
  return fm;
}

export function exportEntityToMarkdown(
  entity: Entity,
  notes: Note[] = [],
): string {
  const fm = buildEntityFrontmatter(entity);
  const lines = entityToMarkdownLines(entity, notes);
  return dumpFrontmatter(fm) + lines.join('\n');
}
