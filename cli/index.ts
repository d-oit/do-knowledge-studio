/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions */
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { readFileSync } from 'fs';
import { setDb } from '../src/db/client.js';
import { initDb } from './db.js';
import { repository } from '../src/db/repository.js';
import { generateSiteHtml, generateJsonExport } from '../src/lib/export-core.js';
import type { Note } from '../src/lib/validation';
import { runMigrations, rollbackLastMigration, getMigrationStatus } from '../src/db/migrate.js';

const program = new Command();

let dbInstance: Awaited<ReturnType<typeof initDb>> | null = null;

async function ensureDb() {
  dbInstance = await initDb();
  setDb(dbInstance);
}

process.on('exit', () => {
  dbInstance?.close();
});

const version = readFileSync(new URL('../VERSION', import.meta.url), 'utf-8').trim();

program
  .name('knowledge-studio')
  .description('CLI for do-knowledge-studio')
  .version(version);

program
  .command('init')
  .description('Initialize workspace')
  .action(() => {
    if (!fs.existsSync('./export')) fs.mkdirSync('./export');
    console.log('Workspace initialized.');
  });

program
  .command('sync')
  .description('Sync Markdown files or URL to DB')
  .argument('<source>', 'directory path or URL')
  .action(async (source) => {
    await ensureDb();
    
    // Detect if source is a URL
    if (source.startsWith('http://') || source.startsWith('https://')) {
      console.log(`Syncing from URL: ${source}`);
      try {
        const { resolveUrl } = await import('../src/lib/resolver.js');
        const resolved = await resolveUrl(source);
        await repository.createEntity({
          name: resolved.title || new URL(source).hostname,
          type: 'concept',
          description: resolved.content || undefined,
          metadata: { source_url: source },
        });
        console.log(`  Imported: ${resolved.title} (${resolved.wordCount} words via ${resolved.provider})`);
        console.log('Sync complete.');
      } catch (err) {
        console.error(`Failed to sync URL: ${err}`);
      }
      return;
    }
    
    // Directory sync (existing behavior)
    console.log(`Syncing from "${source}"...`);
    if (!fs.existsSync(source)) {
      console.error('Directory not found');
      return;
    }
    let files: string[];
    try {
      files = fs.readdirSync(source).filter((f: string) => f.endsWith('.md'));
    } catch (err) {
      console.error(`Failed to read directory: ${err}`);
      return;
    }
    console.log(`Found ${files.length} markdown files.`);
    for (const file of files) {
      const content = fs.readFileSync(path.join(source, file), 'utf-8');
      const lines = content.split('\n');
      const title = lines[0].replace('# ', '').trim();
      const description = lines.slice(1).join('\n').trim().slice(0, 200);
      
      try {
        await repository.createEntity({
          name: title,
          type: 'concept',
          description: description || undefined,
        });
        console.log(`  Imported: ${title}`);
      } catch {
        console.log(`  Skipped: ${title} (already exists)`);
      }
    }
    console.log('Sync complete.');
  });

program
  .command('export')
  .description('Export data (md, json, site)')
  .option('-f, --format <format>', 'format', 'md')
  .option('-o, --output <dir>', 'output directory', './export')
  .action(async (options) => {
    const outDir = options.output;
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    await ensureDb();

    if (options.format === 'json') {
      await exportJson(outDir);
    } else if (options.format === 'site') {
      await exportSite(outDir);
    } else {
      await exportMarkdown(outDir);
    }
    console.log(`Exported in ${options.format} format to ${outDir}`);
  });

async function exportMarkdown(outDir: string) {
  const entities = await repository.getAllEntities();
  
  for (const entity of entities) {
    if (!entity.id) continue;
    const claims = await repository.getClaimsByEntityId(entity.id);
    const notes = await repository.getNotesByEntityId(entity.id);
    
    let md = `# ${entity.name}\n\n`;
    md += `**Type:** ${entity.type}\n\n`;
    if (entity.description) md += `${entity.description}\n\n`;
    
    if (claims.length > 0) {
      md += `## Claims\n\n`;
      for (const claim of claims) {
        md += `- ${claim.statement}`;
        if (claim.confidence !== 1) md += ` (confidence: ${claim.confidence})`;
        md += `\n`;
        if (claim.evidence) md += `  - *Evidence:* ${claim.evidence}\n`;
      }
      md += '\n';
    }
    
    if (notes.length > 0) {
      md += `## Notes\n\n`;
      for (const note of notes) {
        md += `${note.content}\n\n`;
      }
    }

    const safeName = entity.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    fs.writeFileSync(path.join(outDir, `${safeName}.md`), md);
  }
}

async function exportJson(outDir: string) {
  const [entities, links, claims, notes] = await Promise.all([
    repository.getAllEntities(),
    repository.getAllLinks(),
    repository.getAllClaimsGroupedByEntity(),
    repository.getAllNotesGroupedByEntity(),
  ]);
  
  const data = {
    exported_at: new Date().toISOString(),
    entities,
    claims,
    notes,
    links,
  };
  
  fs.writeFileSync(path.join(outDir, 'knowledge.json'), generateJsonExport(data));
}

async function exportSite(outDir: string) {
  const [entities, claims, notes] = await Promise.all([
    repository.getAllEntities(),
    repository.getAllClaimsGroupedByEntity(),
    repository.getAllNotesGroupedByEntity(),
  ]);
  
  const html = generateSiteHtml({ entities, claims, notes });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

program
  .command('entity-create')
  .description('Create entity')
  .argument('<name>')
  .option('-t, --type <type>', 'type', 'concept')
  .option('-d, --description <description>', 'description')
  .option('-u, --source-url <url>', 'source URL for auto-hydration')
  .action(async (name, options) => {
    await ensureDb();
    try {
      const entity = await repository.createEntity({
        name,
        type: options.type,
        description: options.description,
        metadata: options.sourceUrl ? { source_url: options.sourceUrl } : undefined,
      });
      console.log(`Created: ${entity.name} [${entity.type}] (ID: ${entity.id})`);
      
      // CLI: resolve URL inline (not background) for immediate feedback
      if (options.sourceUrl && entity.id) {
        console.log(`Resolving source URL: ${options.sourceUrl}`);
        try {
          const { resolveUrl } = await import('../src/lib/resolver.js');
          const resolved = await resolveUrl(options.sourceUrl);
          if (resolved.content) {
            await repository.updateEntity(entity.id, {
              description: resolved.content || undefined,
            });
            console.log(`  Hydrated description from ${resolved.provider} (${resolved.wordCount} words)`);
          }
        } catch (err) {
          console.error(`  Failed to resolve URL: ${err}`);
        }
      }
    } catch (err) {
      console.error(`Failed to create entity: ${err}`);
    }
  });

program
  .command('entity-list')
  .description('List entities')
  .action(async () => {
    await ensureDb();
    const entities = await repository.getAllEntities();
    if (entities.length === 0) {
      console.log('No entities found.');
      return;
    }
    for (const entity of entities) {
      console.log(`[${entity.type}] ${entity.name}`);
    }
  });

program
  .command('claim-create')
  .description('Create claim for entity')
  .argument('<entity-name>')
  .argument('<statement>')
  .option('-c, --confidence <confidence>', 'confidence', '1.0')
  .action(async (entityName, statement, options) => {
    await ensureDb();
    const entity = await repository.getEntityByName(entityName);
    if (!entity || !entity.id) {
      console.error(`Entity not found: ${entityName}`);
      return;
    }
    try {
      const claim = await repository.createClaim({
        entity_id: entity.id,
        statement,
        confidence: parseFloat(options.confidence),
      });
      console.log(`Claim added to ${entity.name}: ${claim.statement}`);
    } catch (err) {
      console.error(`Failed to create claim: ${err}`);
    }
  });

program
  .command('db:migrate')
  .description('Run pending database migrations')
  .action(async () => {
    await ensureDb();
    console.log('Running pending migrations...');
    const { applied, errors } = await runMigrations(dbInstance!);
    if (applied.length > 0) {
      console.log(`Applied: ${applied.join(', ')}`);
    } else {
      console.log('No pending migrations.');
    }
    if (errors.length > 0) {
      console.error(`Errors: ${errors.join('; ')}`);
    }
  });

program
  .command('db:rollback')
  .description('Rollback the last migration')
  .action(async () => {
    await ensureDb();
    console.log('Rolling back last migration...');
    try {
      await rollbackLastMigration(dbInstance!);
      console.log('Rollback complete.');
    } catch (err) {
      console.error(`Rollback failed: ${err}`);
    }
  });

program
  .command('db:status')
  .description('Show migration status')
  .action(async () => {
    await ensureDb();
    const statuses = await getMigrationStatus(dbInstance!);
    if (statuses.length === 0) {
      console.log('No migrations found.');
      return;
    }
    console.log('Migration Status:');
    for (const s of statuses) {
      const applied = s.appliedAt ?? 'PENDING';
      console.log(`  [${s.version}] ${s.name} — ${applied}`);
    }
  });

program.parse();
