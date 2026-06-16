import { describe, it, expect } from 'vitest';
import {
  CURRENT_EXPORT_VERSION,
  ExportSchemaV1,
  UnsupportedExportVersionError,
  buildKnowledgeStudioExport,
  exportToJson,
  exportToJsonString,
  importExportJson,
  importFromJson,
} from '../export-core';
import type { ExportData } from '../export-core';

const E1 = '11111111-1111-4111-8111-111111111111';
const E2 = '22222222-2222-4222-8222-222222222222';
const C1 = '33333333-3333-4333-8333-333333333333';
const N1 = '44444444-4444-4444-8444-444444444444';

const baseData: ExportData = {
  entities: [
    { id: E1, name: 'A', type: 'concept', description: 'alpha' },
    { id: E2, name: 'B', type: 'person' },
  ],
  claims: {
    [E1]: [{ id: C1, entity_id: E1, statement: 'A is alpha', confidence: 0.9 }],
    [E2]: [],
  },
  notes: {
    [E1]: [{ id: N1, entity_id: E1, content: 'note a', format: 'markdown' }],
    [E2]: [],
  },
  links: [],
  exported_at: '2026-06-16T00:00:00.000Z',
};

describe('KnowledgeStudioExport schema v1.0', () => {
  it('CURRENT_EXPORT_VERSION is "1.0"', () => {
    expect(CURRENT_EXPORT_VERSION).toBe('1.0');
  });

  it('buildKnowledgeStudioExport flattens claims and notes', () => {
    const exp = buildKnowledgeStudioExport(baseData, { title: 'T' });
    expect(exp.entities).toHaveLength(2);
    expect(exp.claims).toHaveLength(1);
    expect(exp.notes).toHaveLength(1);
    expect(exp.metadata.title).toBe('T');
    expect(exp.metadata.source).toBe('browser');
    expect(exp.graph.nodes).toEqual([]);
    expect(exp.graph.edges).toEqual([]);
    expect(exp.mindMap).toBeNull();
  });

  it('exportToJsonString + importExportJson round-trips', () => {
    const exp = buildKnowledgeStudioExport(baseData, { title: 'Round Trip' });
    const json = exportToJsonString(exp);
    const parsed = importExportJson(json);
    expect(parsed.export.version).toBe('1.0');
    expect(parsed.export.metadata.title).toBe('Round Trip');
    expect(parsed.export.claims).toHaveLength(1);
    expect(parsed.export.notes).toHaveLength(1);
  });

  it('exportToJson (on legacy ExportData) produces valid v1.0 JSON', () => {
    const json = exportToJson(baseData, { title: 'Legacy' });
    const parsed = importExportJson(json);
    expect(parsed.export.metadata.title).toBe('Legacy');
  });

  it('importFromJson returns the export', () => {
    const json = exportToJsonString(buildKnowledgeStudioExport(baseData));
    const exp = importFromJson(json);
    expect(exp.version).toBe('1.0');
  });

  it('throws UnsupportedExportVersionError for missing version', () => {
    let caught: unknown = null;
    try {
      importExportJson('{}');
    } catch (e: unknown) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnsupportedExportVersionError);
  });

  it('throws UnsupportedExportVersionError for wrong version', () => {
    const bad = JSON.stringify({ version: '2.0', notes: [], entities: [], claims: [], links: [], graph: { nodes: [], edges: [] }, mindMap: null, tags: [] });
    let caught: unknown = null;
    try {
      importExportJson(bad);
    } catch (e: unknown) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnsupportedExportVersionError);
  });

  it('throws on schema validation failure (e.g. missing required fields)', () => {
    const bad = JSON.stringify({
      version: '1.0',
      exportedAt: '2026-06-16T00:00:00.000Z',
      metadata: { title: '' },
      notes: 'not-an-array',
      entities: [],
      claims: [],
      links: [],
      graph: { nodes: [], edges: [] },
      mindMap: null,
      tags: [],
    });
    let caught: unknown = null;
    try {
      importExportJson(bad);
    } catch (e: unknown) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/Export validation failed/);
  });

  it('ExportSchemaV1.parse accepts a minimal valid payload', () => {
    const min = {
      version: '1.0' as const,
      exportedAt: '2026-06-16T00:00:00.000Z',
      metadata: { title: 'Min' },
      notes: [],
      entities: [],
      claims: [],
      links: [],
      graph: { nodes: [], edges: [] },
      mindMap: null,
      tags: [],
    };
    expect(ExportSchemaV1.parse(min).metadata.title).toBe('Min');
  });
});
