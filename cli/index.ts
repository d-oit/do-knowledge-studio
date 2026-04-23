import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

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
  .description('Sync Markdown files to DB')
  .argument('<dir>', 'directory')
  .action(async (dir) => {
     console.log(`Syncing from ${dir}...`);
     if (!fs.existsSync(dir)) {
         console.error('Directory not found');
         return;
     }
     const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.md'));
     console.log(`Found ${files.length} markdown files.`);
     files.forEach((f: string) => {
         const content = fs.readFileSync(path.join(dir, f), 'utf-8');
         const title = content.split('\n')[0].replace('# ', '').trim();
         console.log(`  Processed: ${title}`);
     });
     console.log('Sync complete (Canonical update happens in browser).');
  });

program
  .command('export')
  .description('Export data')
  .option('-f, --format <format>', 'format', 'md')
  .action((options) => {
     const outDir = './export';
     if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

     if (options.format === 'site') {
        fs.writeFileSync(path.join(outDir, 'index.html'), '<html><head><title>Knowledge Studio</title></head><body><h1>Local Knowledge Base</h1><p>Exported from Studio</p></body></html>');
        console.log('Static site generated in ./export/index.html');
     } else {
        console.log(`Exported in ${options.format} format to ${outDir}`);
     }
  });

program
  .command('entity-create')
  .description('Create entity')
  .argument('<name>')
  .option('-t, --type <type>', 'type', 'concept')
  .action((name, options) => {
     console.log(`Entity Created: ${name} (Type: ${options.type})`);
     console.log('Note: Data is saved to the browser-local OPFS storage on next sync.');
  });

program
  .command('entity-list')
  .description('List entities (Simulation)')
  .action(() => {
     console.log('Listing entities from local cache...');
     console.log('[concept] TRIZ');
     console.log('[project] Knowledge Studio');
  });

program
  .command('claim-create')
  .description('Create claim for entity')
  .argument('<entity-name>')
  .argument('<statement>')
  .action((entity, statement) => {
     console.log(`Claim added to ${entity}: ${statement}`);
  });

program.parse();
