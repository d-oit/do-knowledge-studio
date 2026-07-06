#!/usr/bin/env node
/**
 * check-hardcoded-colors.mjs
 * Fails if any .css, .tsx, .ts file in src/components/ or src/features/
 * contains hardcoded color values (hex, rgb, hsl) instead of var(--token).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../..');

const SCAN_DIRS = ['src/components', 'src/features', 'src/styles'];
const SKIP_FILES = ['src/styles/tokens.css'];
const SKIP_PATTERNS = [/__tests__/, /\.test\./, /\.spec\./, /pdf-styles/];
const KNOWN_LEGACY = [
  'src/styles/components.css',
  'src/styles/features.css',
  'src/styles/utilities.css',
  'src/components/DatabaseSettings.tsx',
  'src/components/TagsPanel.tsx',
  'src/features/ai/AIHarness.tsx',
  'src/features/ai/ChatView.tsx',
  'src/features/editor/EntityTagsSection.tsx',
  'src/features/export/ExportPanel.tsx',
  'src/features/graph/GraphInspector.tsx',
  'src/features/graph/GraphSyncEvents.tsx',
  'src/features/graph/GraphView.tsx',
  'src/features/import/ImportPanel.tsx',
  'src/features/query-builder/QueryBuilder.tsx',
  'src/features/sync/SyncPanel.tsx',
  'src/features/synthesis/SynthesisInbox.tsx',
  'src/features/triz/TrizMatrix.tsx',
  'src/features/voice/VoiceInput.tsx',
];

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;
const RGB_RE = /\brgb[a]?\s*\(/g;
const HSL_RE = /\bhsl[a]?\s*\(/g;

function walk(dir) {
  const results = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) results.push(...walk(full));
    else if (/\.(css|tsx|ts)$/.test(f)) results.push(full);
  }
  return results;
}

let errors = 0;
let warnings = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(resolve(root, dir))) {
    const rel = relative(root, file);
    if (SKIP_FILES.some(s => rel === s)) continue;
    if (SKIP_PATTERNS.some(p => p.test(rel))) continue;
    const content = readFileSync(file, 'utf8');
    const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    const hits = [];
    for (const [m] of stripped.matchAll(HEX_RE)) hits.push(m);
    for (const [m] of stripped.matchAll(RGB_RE)) hits.push(m);
    for (const [m] of stripped.matchAll(HSL_RE)) hits.push(m);
    if (hits.length > 0) {
      const isLegacy = KNOWN_LEGACY.some(l => rel === l);
      const tag = isLegacy ? '⚠️  LEGACY' : '❌ ERROR';
      console[isLegacy ? 'warn' : 'error'](`${tag} ${rel}: ${hits.slice(0,5).join(', ')}${hits.length > 5 ? ` +${hits.length-5} more` : ''}`);
      isLegacy ? warnings++ : errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} hardcoded color error(s). Use var(--token) instead.`);
  process.exit(1);
}
if (warnings > 0) {
  console.warn(`\n${warnings} legacy warning(s) — tracked for migration.`);
}
console.log('✅ check-hardcoded-colors passed');
