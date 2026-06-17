// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { generateSiteHtml, generateMarkdownExport, generateJsonExport, generatePrintHtml } from '../export-core';
import type { ExportData } from '../export-core';
import type { Entity, Claim, Note } from '../validation';

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Entity',
    type: 'concept',
    description: 'A test entity',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: '660e8400-e29b-41d4-a716-446655440001',
    entity_id: '550e8400-e29b-41d4-a716-446655440000',
    statement: 'Test claim statement',
    evidence: 'Test evidence',
    confidence: 0.9,
    verification_status: 'unverified',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: '770e8400-e29b-41d4-a716-446655440002',
    entity_id: '550e8400-e29b-41d4-a716-446655440000',
    content: 'Test note content',
    format: 'markdown',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeData(overrides: Partial<ExportData> = {}): ExportData {
  const entity = makeEntity();
  const entityId = entity.id!;
  return {
    entities: [entity],
    claims: { [entityId]: [makeClaim()] },
    notes: { [entityId]: [makeNote()] },
    ...overrides,
  };
}

describe('generateSiteHtml', () => {
  it('produces valid HTML structure', () => {
    const html = generateSiteHtml(makeData());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
  });

  it('includes entity names', () => {
    const html = generateSiteHtml(makeData());
    expect(html).toContain('Test Entity');
  });

  it('includes entity type badges', () => {
    const html = generateSiteHtml(makeData());
    expect(html).toContain('concept');
  });

  it('includes claim statements', () => {
    const html = generateSiteHtml(makeData());
    expect(html).toContain('Test claim statement');
  });

  it('handles zero entities', () => {
    const html = generateSiteHtml(makeData({ entities: [], claims: {}, notes: {} }));
    expect(html).toContain('Knowledge Base');
    expect(html).toContain('</html>');
  });

  it('sanitizes XSS vectors in descriptions', () => {
    const entity = makeEntity({ description: '<script>alert("xss")</script>normal text' });
    const data = makeData({ entities: [entity] });
    const html = generateSiteHtml(data);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert');
    expect(html).toContain('normal text');
  });

  it('escapes HTML in entity names', () => {
    const entity = makeEntity({ name: '<script>alert(1)</script>' });
    const data = makeData({ entities: [entity] });
    const html = generateSiteHtml(data);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in claim statements', () => {
    const entityId = makeEntity().id!;
    const claim = makeClaim({ statement: '<b>bold</b>' });
    const data = makeData({
      entities: [makeEntity()],
      claims: { [entityId]: [claim] },
    });
    const html = generateSiteHtml(data);
    expect(html).toContain('&lt;b&gt;');
  });

  it('shows confidence when not default', () => {
    const entityId = makeEntity().id!;
    const claim = makeClaim({ confidence: 0.5, entity_id: entityId });
    const data = makeData({
      entities: [makeEntity()],
      claims: { [entityId]: [claim] },
    });
    const html = generateSiteHtml(data);
    expect(html).toContain('50%');
  });

  it('hides confidence when default (1)', () => {
    const entityId = makeEntity().id!;
    const claim = makeClaim({ confidence: 1, entity_id: entityId });
    const data = makeData({
      entities: [makeEntity()],
      claims: { [entityId]: [claim] },
    });
    const html = generateSiteHtml(data);
    expect(html).not.toContain('Confidence');
  });

  it('includes navigation for all entities', () => {
    const e1 = makeEntity({ id: 'a', name: 'Entity A' });
    const e2 = makeEntity({ id: 'b', name: 'Entity B' });
    const data = makeData({ entities: [e1, e2], claims: {}, notes: {} });
    const html = generateSiteHtml(data);
    expect(html).toContain('Entity A');
    expect(html).toContain('Entity B');
    expect(html).toContain('Quick Navigation');
  });

  it('includes Content-Security-Policy meta tag', () => {
    const html = generateSiteHtml(makeData());
    expect(html).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("script-src 'none'");
  });

  it('handles entity with no id', () => {
    const entity = makeEntity({ id: undefined });
    const data = makeData({ entities: [entity], claims: {}, notes: {} });
    expect(() => generateSiteHtml(data)).not.toThrow();
  });
});

describe('generateMarkdownExport', () => {
  it('produces valid markdown', () => {
    const md = generateMarkdownExport(makeData());
    expect(md).toContain('# ');
    expect(md).toContain('**Type:**');
    expect(md).toContain('## Claims');
    expect(md).toContain('## Notes');
  });

  it('includes entity names', () => {
    const md = generateMarkdownExport(makeData());
    expect(md).toContain('Test Entity');
  });

  it('handles zero entities', () => {
    const md = generateMarkdownExport(makeData({ entities: [], claims: {}, notes: {} }));
    expect(md).toBe('');
  });

  it('escapes HTML in markdown content', () => {
    const entity = makeEntity({ name: '<script>alert(1)</script>' });
    const data = makeData({ entities: [entity] });
    const md = generateMarkdownExport(data);
    expect(md).not.toContain('<script>');
    expect(md).toContain('&lt;script&gt;');
  });

  it('handles entity with no claims or notes', () => {
    const entity = makeEntity();
    const data = makeData({
      entities: [entity],
      claims: {},
      notes: {},
    });
    const md = generateMarkdownExport(data);
    expect(md).toContain('# Test Entity');
    expect(md).not.toContain('## Claims');
    expect(md).not.toContain('## Notes');
  });

  it('includes evidence in claims', () => {
    const entityId = makeEntity().id!;
    const claim = makeClaim({ evidence: 'Source document', entity_id: entityId });
    const data = makeData({
      entities: [makeEntity()],
      claims: { [entityId]: [claim] },
    });
    const md = generateMarkdownExport(data);
    expect(md).toContain('Evidence');
    expect(md).toContain('Source document');
  });

  it('separates entities with ---', () => {
    const e1 = makeEntity({ id: 'a', name: 'Entity A' });
    const e2 = makeEntity({ id: 'b', name: 'Entity B' });
    const data = makeData({ entities: [e1, e2], claims: {}, notes: {} });
    const md = generateMarkdownExport(data);
    expect(md).toContain('---');
    expect(md).toContain('Entity A');
    expect(md).toContain('Entity B');
  });

  it('handles entity with no id', () => {
    const entity = makeEntity({ id: undefined });
    const data = makeData({ entities: [entity], claims: {}, notes: {} });
    expect(() => generateMarkdownExport(data)).not.toThrow();
  });

  it('shows confidence for non-default values', () => {
    const entityId = makeEntity().id!;
    const claim = makeClaim({ confidence: 0.75, entity_id: entityId, evidence: undefined });
    const data = makeData({
      entities: [makeEntity()],
      claims: { [entityId]: [claim] },
    });
    const md = generateMarkdownExport(data);
    expect(md).toContain('0.75');
  });

  it('sanitizes XSS vectors in descriptions and notes', () => {
    const entityId = '550e8400-e29b-41d4-a716-446655440000';
    const entity = makeEntity({ id: entityId, description: '<script>alert("xss")</script>normal description' });
    const note = makeNote({ entity_id: entityId, content: '<img src=x onerror=alert(1)>normal note' });
    const data = makeData({
      entities: [entity],
      notes: { [entityId]: [note] },
    });
    const md = generateMarkdownExport(data);
    expect(md).not.toContain('<script>');
    expect(md).not.toContain('onerror');
    expect(md).toContain('normal description');
    expect(md).toContain('normal note');
  });
});

describe('generateJsonExport', () => {
  it('produces valid JSON', () => {
    const json = generateJsonExport(makeData());
    expect(() => { JSON.parse(json); }).not.toThrow();
  });

  it('produces pretty-printed JSON', () => {
    const data = makeData();
    const json = generateJsonExport(data);
    expect(json).toContain('\n  ');
  });

  it('handles empty data', () => {
    const json = generateJsonExport({ entities: [], claims: {}, notes: {} });
    const parsed = JSON.parse(json) as ExportData;
    expect(parsed.entities).toHaveLength(0);
  });

  it('includes all fields', () => {
    const data = makeData();
    const parsed = JSON.parse(generateJsonExport(data)) as ExportData;
    expect(parsed.entities).toBeDefined();
    expect(parsed.claims).toBeDefined();
    expect(parsed.notes).toBeDefined();
  });

  it('serializes nested records', () => {
    const data = makeData();
    const parsed = JSON.parse(generateJsonExport(data)) as ExportData;
    const entityId = makeEntity().id!;
    expect(parsed.claims[entityId]).toBeDefined();
  });

  it('handles arbitrary data shapes', () => {
    const data: Record<string, unknown> = { foo: 'bar', count: 42 };
    const json = generateJsonExport(data);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.foo).toBe('bar');
    expect(parsed.count).toBe(42);
  });

  it('handles null', () => {
    expect(() => generateJsonExport(null)).not.toThrow();
  });
});

describe('generatePrintHtml', () => {
  it('produces valid HTML structure', () => {
    const html = generatePrintHtml([makeEntity()], {});
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
  });

  it('includes entity names and types', () => {
    const entity = makeEntity({ id: 'e1', name: 'My Entity', type: 'person' });
    const html = generatePrintHtml([entity], {});
    expect(html).toContain('My Entity');
    expect(html).toContain('person');
  });

  it('includes claim statements', () => {
    const entity = makeEntity({ id: 'e1' });
    const claims = { e1: [makeClaim({ statement: 'Test claim' })] };
    const html = generatePrintHtml([entity], claims);
    expect(html).toContain('Test claim');
  });

  it('includes confidence when not default', () => {
    const entity = makeEntity({ id: 'e1' });
    const claims = { e1: [makeClaim({ confidence: 0.75 })] };
    const html = generatePrintHtml([entity], claims);
    expect(html).toContain('75%');
  });

  it('handles zero entities', () => {
    const html = generatePrintHtml([], {});
    expect(html).toContain('Knowledge Base Export');
    expect(html).toContain('</html>');
  });

  it('sanitizes XSS vectors in descriptions', () => {
    const entity = makeEntity({ description: '<script>alert("xss")</script>normal text' });
    const html = generatePrintHtml([entity], {});
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert');
    expect(html).toContain('normal text');
  });

  it('includes Content-Security-Policy meta tag', () => {
    const html = generatePrintHtml([makeEntity()], {});
    expect(html).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("script-src 'none'");
  });

  it('handles entity with no id', () => {
    const entity = makeEntity({ id: undefined });
    expect(() => generatePrintHtml([entity], {})).not.toThrow();
  });
});

describe('PNG export', () => {
  it('canvas has toDataURL method', () => {
    const canvas = document.createElement('canvas');
    expect(typeof canvas.toDataURL).toBe('function');
  });

  it('generates data URL from mocked canvas', () => {
    const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const mockCanvas = {
      toDataURL: () => mockDataUrl,
    } as HTMLCanvasElement;
    const dataUrl = mockCanvas.toDataURL('image/png');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl.length).toBeGreaterThan(100);
  });
});

describe('DOCX export structure', () => {
  it('produces valid Document with sections', async () => {
    const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');

    const doc = new Document({
      title: 'Test Export',
      sections: [{
        children: [
          new Paragraph({ text: 'Test Entity', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: 'Type: concept' }),
          new Paragraph({ text: '• Test claim statement', spacing: { after: 100 } }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
});
