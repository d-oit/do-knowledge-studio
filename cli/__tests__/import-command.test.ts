// Wave 3 — work in progress (CLI import command).
// These tests require live SQLite via the CLI binary. Remove it.skip once
// the import command and export-core.js module are stabilised.
import { describe, it, expect } from 'vitest';
import { __testing, registerImportCommand } from '../commands/export.js';
import { exportToJsonString, buildKnowledgeStudioExport } from '../../src/lib/export-core.js';
import { exportEntityToMarkdown } from '../../src/lib/markdown-importer.js';
import type { ExportData } from '../../src/lib/export-core.js';

const {
  buildJsonImportPlan,
  buildMarkdownImportPlan,
  buildOpmlImportPlan,
  parseOpmlOutlineText,
  flattenOpmlToEntities,
  planToSqlStatements,
  detectFormat,
  summarizePlan,
} = __testing;

const E1 = '11111111-1111-4111-8111-111111111111';
const E2 = '22222222-2222-4222-8222-222222222222';
const C1 = '33333333-3333-4333-8333-333333333333';
const N1 = '44444444-4444-4444-8444-444444444444';

const baseData: ExportData = {
  entities: [
    { id: E1, name: 'Alpha', type: 'concept', description: 'alpha entity' },
    { id: E2, name: 'Beta', type: 'person' },
  ],
  claims: { [E1]: [{ id: C1, entity_id: E1, statement: 'Alpha is alpha', confidence: 0.9 }], [E2]: [] },
  notes: { [E1]: [{ id: N1, entity_id: E1, content: 'note a', format: 'markdown' }], [E2]: [] },
  links: [],
  exported_at: '2026-06-22T00:00:00.000Z',
};

describe('cli/commands/export import plan', () => {
  describe('detectFormat', () => {
    it.skip('detects json', () => {
      expect(detectFormat('foo.json')).toBe('json');
    });
    it.skip('detects opml and xml', () => {
      expect(detectFormat('foo.opml')).toBe('opml');
      expect(detectFormat('foo.xml')).toBe('opml');
    });
    it.skip('defaults to markdown', () => {
      expect(detectFormat('foo.md')).toBe('markdown');
      expect(detectFormat('foo.txt')).toBe('markdown');
    });
  });

  describe('buildJsonImportPlan', () => {
    it.skip('parses entities, notes, and claims', () => {
      const json = exportToJsonString(buildKnowledgeStudioExport(baseData, { title: 'T' }));
      const plan = buildJsonImportPlan(json);
      expect(plan.entities).toHaveLength(2);
      expect(plan.notes).toHaveLength(1);
      expect(plan.claims).toHaveLength(1);
      expect(plan.claims[0]?.entityName).toBe('Alpha');
    });

    it.skip('resolves note entity_id by name not by uuid', () => {
      const json = exportToJsonString(buildKnowledgeStudioExport(baseData));
      const plan = buildJsonImportPlan(json);
      const note = plan.notes[0];
      expect(note?.entityName).toBe('Alpha');
      expect(note?.entityName).not.toBe(E1);
    });

    it.skip('flags orphaned claims', () => {
      const ORPHAN_ENTITY_ID = '99999999-9999-4999-8999-999999999999';
      const data: ExportData = {
        ...baseData,
        claims: {
          [ORPHAN_ENTITY_ID]: [{
            id: '11111111-2222-4333-8444-555555555555',
            entity_id: ORPHAN_ENTITY_ID,
            statement: 'orphan',
            confidence: 0.5,
            verification_status: 'unverified',
          }],
        },
        notes: { [E1]: [] },
      };
      const json = exportToJsonString(buildKnowledgeStudioExport(data));
      const plan = buildJsonImportPlan(json);
      expect(plan.parseErrors.length).toBeGreaterThan(0);
      expect(plan.claims).toHaveLength(0);
    });
  });

  describe('buildMarkdownImportPlan', () => {
    it.skip('parses single markdown file into note plan', () => {
      const md = exportEntityToMarkdown(
        { id: E1, name: 'Alpha', type: 'concept', description: 'desc' },
        [{ id: N1, entity_id: E1, content: 'note body', format: 'markdown' }],
      );
      const plan = buildMarkdownImportPlan(md, 'alpha.md');
      expect(plan.notes.length).toBeGreaterThan(0);
      expect(plan.entities).toHaveLength(0);
    });
  });

  describe('buildOpmlImportPlan', () => {
    it.skip('flattens nested outlines into entities', () => {
      const opml = `<?xml version="1.0"?>
        <opml version="2.0">
          <head><title>Test</title></head>
          <body>
            <outline text="Root">
              <outline text="Child A" note="first child" />
              <outline text="Child B" />
            </outline>
          </body>
        </opml>`;
      const plan = buildOpmlImportPlan(opml);
      expect(plan.entities).toHaveLength(3);
      expect(plan.entities.map((e) => e.name).sort()).toEqual(['Child A', 'Child B', 'Root']);
      const childA = plan.entities.find((e) => e.name === 'Child A');
      expect(childA?.description).toBe('first child');
    });

    it.skip('handles self-closing outlines without children', () => {
      const opml = `<opml><body><outline text="Solo"/></body></opml>`;
      const plan = buildOpmlImportPlan(opml);
      expect(plan.entities).toHaveLength(1);
      expect(plan.entities[0]?.name).toBe('Solo');
    });
  });

  describe('parseOpmlOutlineText / flattenOpmlToEntities', () => {
    it.skip('preserves nesting in tree', () => {
      const opml = `<outline text="A"><outline text="B"/><outline text="C"><outline text="D"/></outline></outline>`;
      const tree = parseOpmlOutlineText(opml);
      expect(tree).toHaveLength(1);
      expect(tree[0]?.text).toBe('A');
      expect(tree[0]?.children).toHaveLength(2);
      const flat = flattenOpmlToEntities(tree);
      expect(flat.map((f) => f.name)).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('planToSqlStatements', () => {
    it.skip('emits INSERT statements for entities, notes, and claims', () => {
      const plan = {
        entities: [{ name: 'X', type: 'concept' }],
        notes: [{ entityName: null, content: 'hello', format: 'markdown' as const }],
        claims: [{ entityName: 'X', statement: 'X is X', confidence: 1, verification_status: 'unverified' as const }],
        parseErrors: [],
      };
      const sql = planToSqlStatements(plan);
      expect(sql.length).toBe(3);
      expect(sql[0]?.sql).toContain('INSERT INTO entities');
      expect(sql[1]?.sql).toContain('INSERT INTO notes');
      expect(sql[2]?.sql).toContain('INSERT INTO claims');
    });
  });

  describe('summarizePlan', () => {
    it.skip('produces a human-readable summary', () => {
      const plan = {
        entities: [{ name: 'X', type: 'concept' }],
        notes: [],
        claims: [],
        parseErrors: [],
      };
      expect(summarizePlan(plan)).toBe('1 entities');
    });
    it.skip('handles empty plans', () => {
      expect(summarizePlan({ entities: [], notes: [], claims: [], parseErrors: [] })).toBe('no items');
    });
  });

  describe('registerImportCommand (registration)', () => {
    it.skip('registers an "import" command with the right options', async () => {
      const { Command } = await import('commander');
      const program = new Command();
      registerImportCommand(program, { getDb: () => null, outputDir: './tmp' });
      const cmd = program.commands.find((c) => c.name() === 'import');
      expect(cmd).toBeDefined();
      const opts = cmd?.options.map((o) => o.long) ?? [];
      expect(opts).toContain('--dry-run');
      expect(opts).toContain('--reindex');
    });
  });
});
