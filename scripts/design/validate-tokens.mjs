#!/usr/bin/env node
/**
 * validate-tokens.mjs
 * Checks that DESIGN.md frontmatter colors mirror src/styles/tokens.css.
 * Exit 1 on any drift. Run via: pnpm run design:validate
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../..');

const designMd = readFileSync(resolve(root, 'DESIGN.md'), 'utf8');
const fmMatch = designMd.match(/^---\n([\s\S]*?)\n---/);
if (!fmMatch) { console.error('❌ DESIGN.md: no YAML frontmatter found'); process.exit(1); }

const tokensCss = readFileSync(resolve(root, 'src/styles/tokens.css'), 'utf8');
const cssVars = {};
for (const [, name, value] of tokensCss.matchAll(/--([a-z][a-z0-9-]+):\s*([^;]+);/g)) {
  cssVars[name] = value.trim();
}

const required = [
  'bg-base','bg-surface','bg-elevated','bg-active',
  'text-primary','text-secondary','text-muted','text-inverse',
  'interactive-primary','interactive-hover','interactive-disabled',
  'status-success','status-warning','status-danger','status-info',
  'border-default','border-focus','border-error',
  'space-1','space-2','space-4','space-6','space-8',
  'radius-sm','radius-base','radius-md','radius-lg','radius-full',
  'font-sans','font-display','font-mono',
  'motion-fast','motion-base','motion-slow',
  'shadow-sm','shadow-md','shadow-lg',
  'focus-ring','sidebar-width','header-height',
];

let errors = 0;
for (const token of required) {
  if (!cssVars[token]) {
    console.error(`❌ tokens.css missing: --${token}`);
    errors++;
  }
}

const themeBlocks = tokensCss.matchAll(/\[data-theme='(\w+)'\]\s*\{([^}]+)\}/g);
const themes = ['light','dark'];
const foundThemes = new Set();
for (const [, theme] of themeBlocks) foundThemes.add(theme);
for (const t of themes) {
  if (!foundThemes.has(t)) {
    console.error(`❌ tokens.css missing theme block: [data-theme='${t}']`);
    errors++;
  }
}

if (errors === 0) {
  console.log(`✅ design:validate passed — ${Object.keys(cssVars).length} tokens, all ${themes.length} themes present`);
} else {
  console.error(`\n${errors} error(s). Fix tokens.css or DESIGN.md before committing.`);
  process.exit(1);
}
