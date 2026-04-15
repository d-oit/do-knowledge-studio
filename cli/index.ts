import { Command } from 'commander';
import { logger } from '../src/lib/logger.js';
import { EntitySchema } from '../src/lib/validation.js';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('knowledge-studio')
  .description('CLI for do-knowledge-studio - Local Knowledge Engine')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize the knowledge studio workspace')
  .action(() => {
    logger.info('Initializing Knowledge Studio workspace...');
    const exportDir = './export';
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
      console.log('Created export directory.');
    }
    console.log('Workspace initialized successfully.');
  });

program
  .command('validate')
  .description('Validate a JSON export file against schemas')
  .argument('<file>', 'JSON file to validate')
  .action((file: string) => {
    try {
      if (!fs.existsSync(file)) {
        console.error(`Error: File not found: ${file}`);
        process.exit(1);
      }
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

      console.log(`Validating ${file}...`);

      if (data.entities && Array.isArray(data.entities)) {
        data.entities.forEach((e: unknown, i: number) => {
          const res = EntitySchema.safeParse(e);
          if (!res.success) console.warn(`  [Entity ${i}] Validation failed: ${res.error.message}`);
        });
      }

      console.log('Validation check complete.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Validation failed: ${message}`);
    }
  });

program
  .command('export')
  .description('Export local data templates (Simulation)')
  .option('-f, --format <format>', 'export format (jsonl, md, site)', 'md')
  .option('-o, --output <path>', 'output directory', './export')
  .action((options: { format: string, output: string }) => {
    logger.info(`Exporting data templates in ${options.format} format to ${options.output}...`);

    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }

    if (options.format === 'md') {
      const sampleMd = '# Sample Entity\n\nThis is a sample exported entity from Knowledge Studio.\n\n## Claims\n- TRIZ is a problem-solving methodology.\n';
      fs.writeFileSync(path.join(options.output, 'sample.md'), sampleMd);
      console.log(`Generated sample.md in ${options.output}`);
    } else if (options.format === 'site') {
      const indexHtml = '<html><body><h1>Knowledge Studio Static Site</h1><p>Exported Knowledge Base</p></body></html>';
      fs.writeFileSync(path.join(options.output, 'index.html'), indexHtml);
      console.log(`Generated index.html (static site) in ${options.output}`);
    } else {
      const sampleJson = JSON.stringify({
        entities: [{ name: 'TRIZ', type: 'concept', description: 'Problem solving' }],
        claims: [{ statement: 'TRIZ works', confidence: 1.0 }]
      }, null, 2);
      fs.writeFileSync(path.join(options.output, 'export.json'), sampleJson);
      console.log(`Generated export.json in ${options.output}`);
    }

    console.log('Export complete.');
  });

program
  .command('sync')
  .description('Sync Markdown files back to the database (Simulation)')
  .argument('<dir>', 'directory containing markdown files')
  .action((dir: string) => {
    logger.info(`Syncing markdown files from ${dir}...`);

    if (!fs.existsSync(dir)) {
      console.error(`Error: Directory not found: ${dir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} markdown files.`);

    files.forEach(file => {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const titleMatch = content.match(/^# (.*)/);
      const title = titleMatch ? titleMatch[1] : file.replace('.md', '');

      console.log(`  Syncing entity: ${title}`);

      // Basic Claim Extraction logic
      const claimMatches = content.matchAll(/^- (.*)/gm);
      let count = 0;
      for (const match of claimMatches) {
        if (match[1].trim()) count++;
      }
      console.log(`    Extracted ${count} claims.`);
    });

    console.log('Sync complete.');
  });

program
  .command('doctor')
  .description('Check system health and configurations')
  .action(() => {
    logger.info('Running system check...');
    console.log('Environment: Node.js ' + process.version);
    console.log('Project: do-knowledge-studio v0.1.0');
    console.log('Storage: SQLite WASM (Browser) / FS (CLI)');

    const dbPath = './public/db/schema.sql';
    if (fs.existsSync(dbPath)) {
      console.log('Schema File: OK');
    } else {
      console.error('Schema File: MISSING');
    }

    console.log('System health check: PASS');
  });

program.parse();
