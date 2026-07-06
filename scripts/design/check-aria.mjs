#!/usr/bin/env node
/**
 * check-aria.mjs
 * Finds icon-only buttons (using .icon-button class) that are missing
 * aria-label or aria-labelledby.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../..');

function walk(dir) {
  const results = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) results.push(...walk(full));
    else if (/\.tsx$/.test(f)) results.push(full);
  }
  return results;
}

const ICON_BTN_RE = /<button[^>]*className[^>]*icon-button[^>]*>/g;
const ARIA_LABEL_RE = /aria-label[^=]*=/;

let errors = 0;

for (const dir of ['src/components','src/features']) {
  for (const file of walk(resolve(root, dir))) {
    const rel = relative(root, file);
    const content = readFileSync(file, 'utf8');
    let lineNum = 0;
    for (const line of content.split('\n')) {
      lineNum++;
      if (ICON_BTN_RE.test(line) && !ARIA_LABEL_RE.test(line)) {
        console.error(`❌ ${rel}:${lineNum} icon-only button missing aria-label`);
        errors++;
      }
      ICON_BTN_RE.lastIndex = 0;
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} aria-label error(s). Add aria-label to all icon-only buttons.`);
  process.exit(1);
}
console.log('✅ check-aria passed');
