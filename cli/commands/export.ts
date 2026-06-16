import * as fs from 'fs';
import * as path from 'path';
import type { CommandRegistrar } from './context';
import { generateSiteHtml, generateEntityMarkdown, fetchAllExportData, exportToJson, importFromJson } from '../../src/lib/export-core.js';
import { importMarkdownFiles } from '../../src/lib/markdown-importer.js';

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
  const notes = Object.values(data.notes ?? {}).flatMap(n => n ?? []);
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

export const registerImportCommand: CommandRegistrar = (program) => {
  program
    .command('import <file>')
    .description('Import a JSON or Markdown file')
    .action((file: string) => {
      if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        return;
      }
      const content = fs.readFileSync(file, 'utf-8');
      if (file.endsWith('.json')) {
        try {
          const exp = importFromJson(content);
          console.log(`Imported v${exp.version} export: ${exp.entities.length} entities, ${exp.notes.length} notes, ${exp.claims.length} claims`);
        } catch (err) {
          console.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }
      const result = importMarkdownFiles([{ name: file, content }]);
      console.log(`Imported ${result.notes.length} note(s) from ${file}`);
      for (const e of result.errors) {
        console.error(`  Error: ${e.file}: ${e.error}`);
      }
    });
};
