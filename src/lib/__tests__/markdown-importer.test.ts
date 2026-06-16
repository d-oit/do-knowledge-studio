import { describe, it, expect } from 'vitest';
import {
  exportEntityToMarkdown,
  exportNoteToMarkdown,
  importMarkdownFiles,
  importMarkdownNote,
} from '../markdown-importer';

function buildFrontmatter(body: string, fm: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(', ')}]`);
    } else {
      lines.push(`${k}: ${typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : JSON.stringify(v)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n') + body;
}

describe('markdown-importer round-trip', () => {
  it('parses frontmatter and body', () => {
    const raw = buildFrontmatter('hello world', { id: 'abc', title: 'Hello' });
    const parsed = importMarkdownNote(raw, 'hello.md');
    expect(parsed.body.trim()).toBe('hello world');
    expect(parsed.frontmatter.id).toBe('abc');
    expect(parsed.frontmatter.title).toBe('Hello');
    expect(parsed.filename).toBe('hello.md');
  });

  it('importMarkdownFiles collects notes and errors', () => {
    const result = importMarkdownFiles([
      { name: 'a.md', content: buildFrontmatter('aaa', { id: '1' }) },
      { name: 'b.md', content: 'plain text without frontmatter is fine' },
    ]);
    expect(result.errors).toHaveLength(0);
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0]?.content).toBe('aaa');
  });

  it('exportNoteToMarkdown produces a string with frontmatter', () => {
    const md = exportNoteToMarkdown(
      { id: 'n1', entity_id: 'e1', content: 'body text', format: 'markdown' },
      { entityName: 'Alpha' },
    );
    expect(md).toContain('id: n1');
    expect(md).toContain('body text');
  });

  it('exportEntityToMarkdown includes name and type', () => {
    const md = exportEntityToMarkdown(
      { id: 'e1', name: 'Alpha', type: 'concept', description: 'desc' },
      [{ id: 'n1', entity_id: 'e1', content: 'note body', format: 'markdown' }],
    );
    expect(md).toContain('# Alpha');
    expect(md).toContain('**Type:** concept');
    expect(md).toContain('note body');
  });

  it('round-trip: export then import yields same body and id', () => {
    const note = { id: 'n1', entity_id: 'e1', content: 'body', format: 'markdown' as const };
    const md = exportNoteToMarkdown(note, { entityName: 'Alpha' });
    const parsed = importMarkdownNote(md, 'n1.md');
    expect(parsed.frontmatter.id).toBe('n1');
    expect(parsed.body.trim()).toBe('body');
  });
});
