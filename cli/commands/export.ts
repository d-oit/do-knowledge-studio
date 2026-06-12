import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { repository } from '../../src/db/repository.js';
import { generateSiteHtml, generateJsonExport, generateEntityMarkdown, fetchAllExportData } from '../../src/lib/export-core.js';

type EnsureDbFn = () => Promise<void>;

export function registerExportCommands(program: Command, ensureDb: EnsureDbFn): void {
  program
    .command('export')
    .description('Export data (md, json, site)')
    .option('-f, --format <format>', 'format', 'md')
    .option('-o, --output <dir>', 'output directory', './export')
    .action(async (options: { format?: string; output?: string }) => {
      const outDir = options.output ?? './export';
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      await ensureDb();

      const fmt = options.format ?? 'md';
      if (fmt === 'json') {
        await exportJson(outDir);
      } else if (fmt === 'site') {
        await exportSite(outDir);
      } else {
        await exportMarkdown(outDir);
      }
      console.log(`Exported in ${fmt} format to ${outDir}`);
    });

  async function exportMarkdown(outDir: string) {
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

  async function exportJson(outDir: string) {
    const data = await fetchAllExportData(repository);
    fs.writeFileSync(path.join(outDir, 'knowledge.json'), generateJsonExport(data));
  }

  async function exportSite(outDir: string) {
    const data = await fetchAllExportData(repository);
    const html = generateSiteHtml(data);
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
  }
}
