import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { readFileSync } from 'fs';
import { setDb } from '../src/db/client.js';
import { initDb } from './db.js';
import { repository } from '../src/db/repository.js';
import { generateSiteHtml, generateJsonExport } from '../src/lib/export-core.js';
import { runMigrations, rollbackLastMigration, getMigrationStatus } from '../src/db/migrate.js';

const program = new Command();

let dbInstance: Awaited<ReturnType<typeof initDb>> | null = null;

async function ensureDb() {
  dbInstance = await initDb();
  setDb(dbInstance);
}

process.on('exit', () => {
  void dbInstance?.close();
});

const version = (() => {
  try {
    return readFileSync(new URL('../VERSION', import.meta.url), 'utf-8').trim();
  } catch {
    return 'unknown';
  }
})();

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
  .action(async (source: string) => {
    await ensureDb();
    
    const src = String(source);
    // Detect if source is a URL
    if (src.startsWith('http://') || src.startsWith('https://')) {
      console.log(`Syncing from URL: ${src}`);
      try {
        const { resolveUrl } = await import('../src/lib/resolver.js');
        const resolved = await resolveUrl(src);
        await repository.createEntity({
          name: resolved.title || new URL(src).hostname,
          type: 'concept',
          description: resolved.content || undefined,
          metadata: { source_url: src },
        });
        console.log(`  Imported: ${resolved.title} (${resolved.wordCount} words via ${resolved.provider})`);
        console.log('Sync complete.');
      } catch (err) {
        console.error(`Failed to sync URL: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
    
    // Directory sync (existing behavior)
    console.log(`Syncing from "${src}"...`);
    if (!fs.existsSync(src)) {
      console.error('Directory not found');
      return;
    }
    let files: string[];
    try {
      files = fs.readdirSync(src).filter((f: string) => f.endsWith('.md'));
    } catch (err) {
      console.error(`Failed to read directory: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    console.log(`Found ${files.length} markdown files.`);
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(src, file), 'utf-8');
        const lines = content.split('\n');
        const title = lines[0].replace('# ', '').trim();
        const description = lines.slice(1).join('\n').trim().slice(0, 200);

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
  const { escapeHtml } = await import('../src/lib/security.js');
  const entities = await repository.getAllEntities();
  
  for (const entity of entities) {
    if (!entity.id) continue;
    const claims = await repository.getClaimsByEntityId(entity.id);
    const notes = await repository.getNotesByEntityId(entity.id);
    
    let md = `# ${escapeHtml(entity.name)}\n\n`;
    md += `**Type:** ${escapeHtml(entity.type)}\n\n`;
    if (entity.description) md += `${entity.description}\n\n`;
    
    if (claims.length > 0) {
      md += `## Claims\n\n`;
      for (const claim of claims) {
        md += `- ${escapeHtml(claim.statement)}`;
        if (claim.confidence !== 1) md += ` (confidence: ${claim.confidence})`;
        md += `\n`;
        if (claim.evidence) md += `  - *Evidence:* ${escapeHtml(claim.evidence)}\n`;
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
  .action(async (name: string, options: { type?: string; description?: string; sourceUrl?: string }) => {
    await ensureDb();
    try {
      const entity = await repository.createEntity({
        name,
        type: options.type ?? 'concept',
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
          console.error(`  Failed to resolve URL: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      console.error(`Failed to create entity: ${err instanceof Error ? err.message : String(err)}`);
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
  .action(async (entityName: string, statement: string, options: { confidence?: string }) => {
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
        confidence: parseFloat(options.confidence ?? '1.0'),
      });
      console.log(`Claim added to ${entity.name}: ${claim.statement}`);
    } catch (err) {
      console.error(`Failed to create claim: ${err instanceof Error ? err.message : String(err)}`);
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
      console.error(`Rollback failed: ${err instanceof Error ? err.message : String(err)}`);
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

program
  .command('db:backup')
  .description('Backup the SQLite database')
  .argument('[path]', 'output path for the backup file')
  .action(async (pathArg: string | undefined) => {
    await ensureDb();
    const backupPath = pathArg ?? `.studio-cli-backup-${Date.now()}.db`;
    const resolvedPath = path.resolve(process.cwd(), backupPath);
    console.log(`Backing up database to ${resolvedPath}...`);
    try {
      await dbInstance!.exec({ sql: `VACUUM INTO '${resolvedPath.replace(/'/g, "''")}'` });
      console.log(`Backup created: ${resolvedPath}`);
    } catch (err) {
      console.error(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program.parse();
