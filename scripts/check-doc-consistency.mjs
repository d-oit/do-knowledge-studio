#!/usr/bin/env node
/**
 * Lightweight public-documentation consistency check (Issue #1042).
 *
 * Verifies that maintained product docs do not drift from source facts:
 * - `pnpm run <script>` references exist in package.json;
 * - `./scripts/<file>` references exist;
 * - the README's numbered view count and table match `VIEW_IDS`;
 * - the architecture view table lists every view;
 * - canonical storage claims mention IndexedDB and do not imply SQLite/FTS5
 *   is the active store;
 * - every export format in `export-types.ts` is named in the README;
 * - optional data-egress capabilities are labelled;
 * - PHASES history lines that mention SQLite are marked historical.
 *
 * Exit 0 when consistent; non-zero with one line per drift.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Resolve repository-relative literals from this script's location, not the
// caller's working directory.
process.chdir(fileURLToPath(new URL('..', import.meta.url)))

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = new Set(Object.keys(packageJson.scripts ?? {}))
const scriptFiles = new Set(readdirSync('scripts'))
const readme = readFileSync('README.md', 'utf8')
const architecture = readFileSync('plans/ARCHITECTURE.md', 'utf8')
const goal = readFileSync('plans/GOAL.md', 'utf8')
const phases = readFileSync('plans/PHASES.md', 'utf8')
const types = readFileSync('src/lib/studio/types.ts', 'utf8')
const exportTypes = readFileSync('src/components/studio/views/export-types.ts', 'utf8')

// --- Script references -----------------------------------------------------
for (const match of readme.matchAll(/pnpm run ([a-zA-Z0-9:_-]+)/g)) {
  if (!scripts.has(match[1])) {
    fail(`README references missing package script: pnpm run ${match[1]}`)
  }
}
for (const match of readme.matchAll(/\.\/scripts\/([a-zA-Z0-9_.-]+)/g)) {
  if (!scriptFiles.has(match[1])) {
    fail(`README references missing script file: scripts/${match[1]}`)
  }
}

// --- View inventory --------------------------------------------------------
const viewBlock = types.match(/export const VIEW_IDS = \[([\s\S]*?)\] as const/)
if (!viewBlock) {
  fail('could not read VIEW_IDS from src/lib/studio/types.ts')
} else {
  const views = [...viewBlock[1].matchAll(/'([a-z]+)'/g)].map((match) => match[1])
  const heading = readme.match(/## The (\d+) Studio Views/)
  if (!heading) {
    fail('README is missing a numeric "## The N Studio Views" heading')
  } else if (Number(heading[1]) !== views.length) {
    fail(`README says ${heading[1]} Studio Views but VIEW_IDS has ${views.length}`)
  }
  const sectionStart = readme.indexOf('## The ')
  const nextSection = readme.indexOf('\n---', sectionStart)
  const section = readme.slice(sectionStart, nextSection === -1 ? undefined : nextSection)
  const tableRows = section.split('\n').filter((line) => /^\| \*\*[^*]+\*\*/.test(line)).length
  if (tableRows !== views.length) {
    fail(`README view table has ${tableRows} rows but VIEW_IDS has ${views.length}`)
  }
  const labels = new Map([
    ['home', 'Home'],
    ['editor', 'Editor'],
    ['library', 'Library'],
    ['graph', 'Graph'],
    ['mindmap', 'Mind Map'],
    ['timeline', 'Timeline'],
    ['chat', 'Chat'],
    ['ai', 'AI Harness'],
    ['triz', 'TRIZ'],
    ['export', 'Export'],
    ['sync', 'Sync'],
  ])
  for (const view of views) {
    const label = labels.get(view) ?? view
    if (!architecture.includes(`| ${label} |`) && !architecture.includes(`**${label}**`)) {
      fail(`plans/ARCHITECTURE.md view table is missing: ${label}`)
    }
  }
}

// --- Storage truth ---------------------------------------------------------
for (const [name, text] of [
  ['README.md', readme],
  ['plans/ARCHITECTURE.md', architecture],
  ['plans/GOAL.md', goal],
]) {
  if (!/IndexedDB/i.test(text)) {
    fail(`${name} does not mention the canonical IndexedDB store`)
  }
  for (const line of text.split('\n')) {
    if (/SQLite|FTS5/i.test(line) && !/no\s+SQLite|historical|not\s+SQLite/i.test(line)) {
      fail(`${name} implies SQLite/FTS5 is current: ${line.trim()}`)
    }
  }
}
for (const [index, line] of phases.split('\n').entries()) {
  if (
    /SQLite|FTS5/i.test(line) &&
    !/historical/i.test(line) &&
    !line.trimStart().startsWith('>')
  ) {
    fail(`plans/PHASES.md:${index + 1} mentions SQLite/FTS5 without a historical label`)
  }
}

// --- Export inventory ------------------------------------------------------
const formatBlock = exportTypes.match(/export const FORMATS[^=]*= \[([\s\S]*?)\n\]/)
if (!formatBlock) {
  fail('could not read FORMATS from export-types.ts')
} else {
  const formatIds = [...formatBlock[1].matchAll(/id: '([a-z]+)'/g)].map((match) => match[1])
  const keywords = new Map([
    ['json', 'JSON'],
    ['markdown', 'Markdown'],
    ['html', 'HTML'],
    ['pdf', 'PDF'],
    ['docx', 'DOCX'],
    ['encrypted', 'encrypted'],
    ['okf', 'OKF'],
  ])
  for (const id of formatIds) {
    const keyword = keywords.get(id) ?? id
    if (!readme.includes(keyword)) {
      fail(`README does not name export format: ${keyword}`)
    }
  }
  if (!/backup/i.test(readme) || !/\.dksb/.test(readme)) {
    fail('README does not document the verified .dksb backup format')
  }
}

// --- Optional egress labels ------------------------------------------------
for (const capability of ['OpenRouter', 'Ollama', 'web research', 'P2P']) {
  if (!readme.toLowerCase().includes(capability.toLowerCase())) {
    fail(`README does not label optional egress capability: ${capability}`)
  }
}
if (!/data (?:leaves|egress)|off-device|transmit/i.test(readme)) {
  fail('README does not explain when data leaves the device')
}

if (process.exitCode !== 1) {
  console.log('✓ Public documentation consistency checks passed')
}
