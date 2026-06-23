import * as fs from 'fs';
import * as path from 'path';
import type { CommandRegistrar } from './context';
import { generateSiteHtml, generateEntityMarkdown, fetchAllExportData, exportToJson, importFromJson } from '../../src/lib/export-core.js';
import { importMarkdownFiles } from '../../src/lib/markdown-importer.js';

interface OpmlOutline {
  text: string;
  note?: string;
  children: OpmlOutline[];
}

interface ImportPlanEntity {
  name: string;
  type: string;
  description?: string;
}

interface ImportPlanNote {
  entityName: string | null;
  content: string;
  format: string;
}

interface ImportPlanClaim {
  entityName: string;
  statement: string;
  confidence: number;
  verification_status: string;
}

interface ImportPlan {
  entities: ImportPlanEntity[];
  notes: ImportPlanNote[];
  claims: ImportPlanClaim[];
  parseErrors: string[];
}

type ImportFormat = 'json' | 'opml' | 'markdown';

function detectFormatInner(fileName: string): ImportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.opml') || lower.endsWith('.xml')) return 'opml';
  return 'markdown';
}

function parseOpmlOutlineText(opml: string): OpmlOutline[] {
  const tagRe = /<(\/?)outline\b([^>]*)>/g;
  const roots: OpmlOutline[] = [];
  const stack: OpmlOutline[] = [];
  let match: RegExpExecArray | null = tagRe.exec(opml);
  while (match !== null) {
    const isClose = match[1] === '/';
    const isSelfClose = match[2].trimEnd().endsWith('/');
    if (isClose) {
      stack.pop();
      continue;
    }
    const attrs = parseAttrs(match[2].trimEnd().replace(/\/$/, ''));
    const entry: OpmlOutline = {
      text: attrs.text || attrs.title || 'Untitled',
      ...(attrs.note ? { note: attrs.note } : {}),
      children: [],
    };
    const parent = stack.at(-1);
    if (parent) parent.children.push(entry);
    else roots.push(entry);
    if (!isSelfClose) stack.push(entry);
    match = tagRe.exec(opml);
  }
  return roots;
}

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_][\w:-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null = re.exec(attrString);
  while (m !== null) {
    attrs[m[1]] = m[2];
    m = re.exec(attrString);
  }
  return attrs;
}

function flattenOpmlToEntities(entries: OpmlOutline[]): ImportPlanEntity[] {
  const out: ImportPlanEntity[] = [];
  const visit = (e: OpmlOutline): void => {
    if (e.text.trim()) {
      out.push({
        name: e.text.trim(),
        type: 'concept',
        ...(e.note ? { description: e.note } : {}),
      });
    }
    for (const child of e.children) visit(child);
  };
  for (const root of entries) visit(root);
  return out;
}

function buildJsonImportPlan(json: string): ImportPlan {
  try {
    const exp = importFromJson(json);
    const entities: ImportPlanEntity[] = exp.entities.map(e => ({
      name: e.name,
      type: e.type || 'concept',
      ...(e.description ? { description: e.description } : {}),
    }));

    const notes: ImportPlanNote[] = [];
    for (const note of exp.notes) {
      const entityName = note.entity_id
        ? exp.entities.find(e => e.id === note.entity_id)?.name ?? null
        : null;
      notes.push({ entityName, content: note.content, format: note.format });
    }

    const claims: ImportPlanClaim[] = [];
    for (const claim of exp.claims) {
      const entityName = exp.entities.find(e => e.id === claim.entity_id)?.name ?? 'Unknown';
      claims.push({
        entityName,
        statement: claim.statement,
        confidence: claim.confidence,
        verification_status: claim.verification_status,
      });
    }

    return { entities, notes, claims, parseErrors: [] };
  } catch (err) {
    return { entities: [], notes: [], claims: [], parseErrors: [String(err)] };
  }
}

function buildMarkdownImportPlan(md: string, fileName: string): ImportPlan {
  const result = importMarkdownFiles([{ name: fileName, content: md }]);
  const notes: ImportPlanNote[] = result.notes.map(n => ({
    entityName: n.title || null,
    content: n.content,
    format: n.format,
  }));
  const parseErrors = result.errors.map(e => `${e.file}: ${e.error}`);
  return { entities: [], notes, claims: [], parseErrors };
}

function buildOpmlImportPlan(opml: string): ImportPlan {
  const tree = parseOpmlOutlineText(opml);
  const entities = flattenOpmlToEntities(tree);
  return { entities, notes: [], claims: [], parseErrors: [] };
}

function planToSqlStatements(plan: ImportPlan): { sql: string }[] {
  const stmts: { sql: string }[] = [];
  for (const e of plan.entities) {
    stmts.push({ sql: `INSERT INTO entities (name, type, description) VALUES ('${e.name}', '${e.type}', ${e.description ? `'${e.description}'` : 'NULL'})` });
  }
  for (const n of plan.notes) {
    stmts.push({ sql: `INSERT INTO notes (entity_name, content, format) VALUES (${n.entityName ? `'${n.entityName}'` : 'NULL'}, '${n.content}', '${n.format}')` });
  }
  for (const c of plan.claims) {
    stmts.push({ sql: `INSERT INTO claims (entity_name, statement, confidence, verification_status) VALUES ('${c.entityName}', '${c.statement}', ${c.confidence}, '${c.verification_status}')` });
  }
  return stmts;
}

function summarizePlan(plan: ImportPlan): string {
  const total = plan.entities.length + plan.notes.length + plan.claims.length;
  if (total === 0) return 'no items';
  return `${total} entities`;
}

async function exportMarkdown(outDir: string): Promise<void> {
  const { repository } = await import('../../src/db/repository.js');
  const data = await fetchAllExportData(repository);
  for (const entity of data.entities) {
    if (!entity.id) continue;
    const claims = data.claims[entity.id] ?? [];
    const notes = data.notes[entity.id] ?? [];
    const md = generateEntityMarkdown(entity, claims, notes);
    const safeName = entity.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    fs.writeFileSync(path.join(outDir, `${safeName}.md`), md);
  }
}

async function exportJson(outDir: string): Promise<void> {
  const { repository } = await import('../../src/db/repository.js');
  const data = await fetchAllExportData(repository);
  const versioned = exportToJson(data, { title: 'Knowledge Base Export', source: 'cli' });
  fs.writeFileSync(path.join(outDir, 'knowledge.json'), versioned);
}

async function exportSite(outDir: string): Promise<void> {
  const { repository } = await import('../../src/db/repository.js');
  const data = await fetchAllExportData(repository);
  const html = generateSiteHtml(data);
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

async function exportPdf(outDir: string): Promise<void> {
  const { repository } = await import('../../src/db/repository.js');
  const { exportAllNotesToPDF } = await import('../../src/features/export/pdf-exporter.js');
  const data = await fetchAllExportData(repository);
  const notes = Object.values(data.notes).flat();
  const entities = data.entities;
  const blob = await exportAllNotesToPDF(notes, entities, { title: 'Knowledge Base Export' });
  const arrayBuffer = await blob.arrayBuffer();
  fs.writeFileSync(path.join(outDir, 'knowledge.pdf'), Buffer.from(arrayBuffer));
}

export const registerExportCommand: CommandRegistrar = (program) => {
  program
    .command('export')
    .description('Export data (md, json, site, pdf)')
    .option('-f, --format <format>', 'format', 'md')
    .option('-o, --output <dir>', 'output directory', './export')
    .action(async (options: { format?: string; output?: string }) => {
      const outDir = options.output ?? './export';
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const fmt = options.format ?? 'md';
      if (fmt === 'json') {
        await exportJson(outDir);
      } else if (fmt === 'site') {
        await exportSite(outDir);
      } else if (fmt === 'pdf') {
        await exportPdf(outDir);
      } else {
        await exportMarkdown(outDir);
      }
      console.log(`Exported in ${fmt} format to ${outDir}`);
    });
};

export const registerImportCommand: CommandRegistrar = (program, ctx) => {
  program
    .command('import <file>')
    .description('Import a JSON or Markdown file')
    .action(async (file: string) => {
      if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        return;
      }
      const content = fs.readFileSync(file, 'utf-8');
      const db = ctx.getDb();
      if (!db) {
        console.error('Database not initialized');
        return;
      }
      const { repository } = await import('../../src/db/repository.js');

      if (file.endsWith('.json')) {
        try {
          const exp = importFromJson(content);
          let imported = 0;

          // Import entities
          for (const entity of exp.entities) {
            try {
              await repository.createEntity({
                name: entity.name,
                type: entity.type || 'concept',
                description: entity.description,
                metadata: entity.metadata ? JSON.stringify(entity.metadata) : undefined,
              });
              imported++;
            } catch (err) {
              console.error(`  Failed to import entity "${entity.name}": ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          // Import notes
          for (const note of exp.notes) {
            try {
              await repository.createNote({
                entity_id: note.entity_id || null,
                content: note.content,
                format: note.format,
              });
              imported++;
            } catch (err) {
              console.error(`  Failed to import note: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          // Import claims
          for (const claim of exp.claims) {
            try {
              await repository.createClaim({
                entity_id: claim.entity_id,
                statement: claim.statement,
                confidence: claim.confidence || 1.0,
                source: claim.source,
                verification_status: claim.verification_status,
              });
              imported++;
            } catch (err) {
              console.error(`  Failed to import claim: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          console.log(`Imported ${imported} items from v${exp.version} export (${exp.entities.length} entities, ${exp.notes.length} notes, ${exp.claims.length} claims)`);
        } catch (err) {
          console.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }

      // Markdown import
      const result = importMarkdownFiles([{ name: file, content }]);
      let imported = 0;
      for (const note of result.notes) {
        try {
          await repository.createNote({
            entity_id: note.entityId || null,
            content: note.content,
            format: note.format,
          });
          imported++;
        } catch (err) {
          console.error(`  Failed to import note from ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      console.log(`Imported ${imported} note(s) from ${file}`);
      for (const e of result.errors) {
        console.error(`  Error: ${e.file}: ${e.error}`);
      }
    });
};

export const __testing = {
  detectFormat: detectFormatInner,
  buildJsonImportPlan,
  buildMarkdownImportPlan,
  buildOpmlImportPlan,
  parseOpmlOutlineText,
  flattenOpmlToEntities,
  planToSqlStatements,
  summarizePlan,
};
