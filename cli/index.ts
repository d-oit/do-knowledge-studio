import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { setDb } from '../src/db/client.js';
import { initDb } from './db.js';
import { repository } from '../src/db/repository.js';
import type { Note } from '../src/lib/validation';
import { escapeHtml } from '../src/lib/security.js';

const program = new Command();

async function ensureDb() {
  const db = await initDb();
  setDb(db);
}

program
  .name('knowledge-studio')
  .description('CLI for do-knowledge-studio')
  .version('0.1.0');

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
    const files = fs.readdirSync(source).filter((f: string) => f.endsWith('.md'));
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
  const entities = await repository.getAllEntities();
  const links = await repository.getAllLinks();
  
  const claims: Record<string, Claim[]> = {};
  const notes: Record<string, Note[]> = {};
  
  for (const entity of entities) {
    if (!entity.id) continue;
    claims[entity.id] = await repository.getClaimsByEntityId(entity.id);
    notes[entity.id] = await repository.getNotesByEntityId(entity.id);
  }
  
  const data = {
    exported_at: new Date().toISOString(),
    entities,
    claims,
    notes,
    links,
  };
  
  fs.writeFileSync(path.join(outDir, 'knowledge.json'), JSON.stringify(data, null, 2));
}

async function exportSite(outDir: string) {
  const entities = await repository.getAllEntities();
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Knowledge Base</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { margin-top: 2rem; }
    .entity { margin-bottom: 2rem; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; }
    .type { background: #f0f0f0; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.875rem; }
    .claim { margin: 0.5rem 0; padding-left: 1rem; border-left: 3px solid #007bff; }
    a { color: #007bff; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Knowledge Base</h1>
  <p>Exported from Knowledge Studio</p>
`;

  for (const entity of entities) {
    const entityId = entity.id!;
    const claims = await repository.getClaimsByEntityId(entityId);
    const safeId = entity.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    html += `\n  <div class="entity" id="${safeId}">\n`;
    html += `    <h2><a href="#${safeId}">${entity.name}</a></h2>\n`;
    html += `    <span class="type">${entity.type}</span>\n`;
    
    if (entity.description) {
      html += `\n    <p>${escapeHtml(entity.description)}</p>\n`;
    }
    
    if (claims.length > 0) {
      html += `\n    <h3>Claims</h3>\n`;
      for (const claim of claims) {
        html += `    <div class="claim">${claim.statement}`;
        if (claim.confidence !== 1) html += ` <em>(confidence: ${claim.confidence})</em>`;
        html += `</div>\n`;
      }
    }
    
    html += `  </div>\n`;
  }

  html += `
</body>
</html>`;

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

program.parse();
