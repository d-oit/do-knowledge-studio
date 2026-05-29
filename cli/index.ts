import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { readFileSync } from 'fs';
import { setDb } from '../src/db/client.js';
import { initDb } from './db.js';
import { repository } from '../src/db/repository.js';
import { generateSiteHtml, generateJsonExport, generateEntityMarkdown } from '../src/lib/export-core.js';
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
  const entities = await repository.getAllEntities();
  
  for (const entity of entities) {
    if (!entity.id) continue;
    const claims = await repository.getClaimsByEntityId(entity.id);
    const notes = await repository.getNotesByEntityId(entity.id);
    
    const md = generateEntityMarkdown(entity, claims, notes);

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
    if (!dbInstance) throw new Error('Database not initialized');
    console.log('Running pending migrations...');
    const { applied, errors } = await runMigrations(dbInstance);
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
    if (!dbInstance) throw new Error('Database not initialized');
    console.log('Rolling back last migration...');
    try {
      await rollbackLastMigration(dbInstance);
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
    if (!dbInstance) throw new Error('Database not initialized');
    const statuses = await getMigrationStatus(dbInstance);
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
    if (!dbInstance) throw new Error('Database not initialized');
    const backupPath = pathArg ?? `.studio-cli-backup-${Date.now()}.db`;
    const resolvedPath = path.resolve(process.cwd(), backupPath);
    console.log(`Backing up database to ${resolvedPath}...`);
    try {
      await dbInstance.exec({ sql: `VACUUM INTO '${resolvedPath.replace(/'/g, "''")}'` });
      console.log(`Backup created: ${resolvedPath}`);
    } catch (err) {
      console.error(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('search')
  .description('Full-text search entities')
  .argument('<query>', 'search query')
  .action(async (query: string) => {
    await ensureDb();
    try {
      const results = await repository.searchEntities(query);
      if (results.length === 0) {
        console.log('No results found.');
        return;
      }
      for (const r of results) {
        const desc = r.description ? ` — ${r.description.slice(0, 80)}` : '';
        console.log(`[${r.type}] ${r.name}${desc}`);
      }
    } catch (err) {
      console.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('entity-update')
  .description('Update an entity')
  .argument('<name>', 'entity name')
  .option('-t, --type <type>', 'new type')
  .option('-d, --description <description>', 'new description')
  .action(async (name: string, options: { type?: string; description?: string }) => {
    await ensureDb();
    try {
      const entity = await repository.getEntityByName(name);
      if (!entity || !entity.id) {
        console.error(`Entity not found: ${name}`);
        return;
      }
      const update: Record<string, string> = {};
      if (options.type) update.type = options.type;
      if (options.description) update.description = options.description;
      if (Object.keys(update).length === 0) {
        console.log('No changes specified. Use -t or -d to update fields.');
        return;
      }
      const updated = await repository.updateEntity(entity.id, update);
      console.log(`Updated: ${updated.name} [${updated.type}]`);
    } catch (err) {
      console.error(`Failed to update entity: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('entity-delete')
  .description('Delete an entity and its cascade')
  .argument('<name>', 'entity name')
  .action(async (name: string) => {
    await ensureDb();
    try {
      const entity = await repository.getEntityByName(name);
      if (!entity || !entity.id) {
        console.error(`Entity not found: ${name}`);
        return;
      }
      await repository.deleteEntity(entity.id);
      console.log(`Deleted: ${name}`);
    } catch (err) {
      console.error(`Failed to delete entity: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('entity-get')
  .description('Get an entity by name')
  .argument('<name>', 'entity name')
  .action(async (name: string) => {
    await ensureDb();
    try {
      const entity = await repository.getEntityByName(name);
      if (!entity) {
        console.error(`Entity not found: ${name}`);
        return;
      }
      console.log(`ID: ${entity.id}`);
      console.log(`Name: ${entity.name}`);
      console.log(`Type: ${entity.type}`);
      if (entity.description) console.log(`Description: ${entity.description.slice(0, 200)}`);
      console.log(`Created: ${entity.created_at}`);
      console.log(`Updated: ${entity.updated_at}`);
    } catch (err) {
      console.error(`Failed to get entity: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('link-create')
  .description('Create a link between two entities')
  .argument('<source>', 'source entity name')
  .argument('<target>', 'target entity name')
  .option('-r, --relation <relation>', 'relation type', 'related')
  .action(async (source: string, target: string, options: { relation?: string }) => {
    await ensureDb();
    try {
      const sourceEntity = await repository.getEntityByName(source);
      if (!sourceEntity || !sourceEntity.id) {
        console.error(`Source entity not found: ${source}`);
        return;
      }
      const targetEntity = await repository.getEntityByName(target);
      if (!targetEntity || !targetEntity.id) {
        console.error(`Target entity not found: ${target}`);
        return;
      }
      const link = await repository.createLink({
        source_id: sourceEntity.id,
        target_id: targetEntity.id,
        relation: options.relation ?? 'related',
      });
      console.log(`Link created: ${source} --[${link.relation}]--> ${target} (ID: ${link.id})`);
    } catch (err) {
      console.error(`Failed to create link: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('link-list')
  .description('List all links')
  .action(async () => {
    await ensureDb();
    try {
      const links = await repository.getAllLinks();
      const entities = await repository.getAllEntities();
      const entityMap = new Map<string, string>();
      for (const e of entities) {
        if (e.id) entityMap.set(e.id, e.name);
      }
      if (links.length === 0) {
        console.log('No links found.');
        return;
      }
      for (const link of links) {
        const source = entityMap.get(link.source_id) || link.source_id;
        const target = entityMap.get(link.target_id) || link.target_id;
        console.log(`[${link.id}] ${source} --[${link.relation}]--> ${target}`);
      }
    } catch (err) {
      console.error(`Failed to list links: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('link-delete')
  .description('Delete a link by ID')
  .argument('<id>', 'link ID')
  .action(async (id: string) => {
    await ensureDb();
    try {
      await repository.deleteLink(id);
      console.log(`Link deleted: ${id}`);
    } catch (err) {
      console.error(`Failed to delete link: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('note-create')
  .description('Create a note for an entity')
  .argument('<entity>', 'entity name')
  .argument('<content>', 'note content')
  .action(async (entityName: string, content: string) => {
    await ensureDb();
    try {
      const entity = await repository.getEntityByName(entityName);
      if (!entity || !entity.id) {
        console.error(`Entity not found: ${entityName}`);
        return;
      }
      const note = await repository.createNote({
        entity_id: entity.id,
        content,
      });
      console.log(`Note created for ${entityName} (ID: ${note.id})`);
    } catch (err) {
      console.error(`Failed to create note: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('note-list')
  .description('List notes for an entity')
  .argument('<entity>', 'entity name')
  .action(async (entityName: string) => {
    await ensureDb();
    try {
      const entity = await repository.getEntityByName(entityName);
      if (!entity || !entity.id) {
        console.error(`Entity not found: ${entityName}`);
        return;
      }
      const notes = await repository.getNotesByEntityId(entity.id);
      if (notes.length === 0) {
        console.log(`No notes for ${entityName}.`);
        return;
      }
      for (const note of notes) {
        console.log(`[${note.id}] ${note.content.slice(0, 120)}${note.content.length > 120 ? '...' : ''}`);
      }
    } catch (err) {
      console.error(`Failed to list notes: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('snapshot-list')
  .description('List graph snapshots')
  .action(async () => {
    await ensureDb();
    try {
      const snapshots = await repository.listSnapshots();
      if (snapshots.length === 0) {
        console.log('No snapshots found.');
        return;
      }
      for (const snap of snapshots) {
        const nodeCount = (() => { try { return (JSON.parse(snap.nodes_json) as { id: string }[]).length; } catch { return 0; } })();
        const edgeCount = (() => { try { return (JSON.parse(snap.edges_json) as { id: string }[]).length; } catch { return 0; } })();
        console.log(`[${snap.id}] ${snap.name} — ${nodeCount} nodes, ${edgeCount} edges — ${snap.created_at}`);
        if (snap.description) console.log(`  ${snap.description}`);
      }
    } catch (err) {
      console.error(`Failed to list snapshots: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program
  .command('db:reset')
  .description('Reset the database (drop all tables and re-run schema)')
  .action(async () => {
    await ensureDb();
    if (!dbInstance) throw new Error('Database not initialized');
    console.log('Resetting database...');
    try {
      await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS claim_search_idx' });
      await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS entity_search_idx' });
      await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS web_cache' });
      await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS graph_snapshots' });
      await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS schema_version' });
      await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS links' });
      await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS notes' });
      await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS claims' });
      await dbInstance.exec({ sql: 'DROP TABLE IF EXISTS entities' });
      const freshDb = await initDb();
      setDb(freshDb);
      dbInstance = freshDb;
      console.log('Database reset complete.');
    } catch (err) {
      console.error(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

program.parse();
