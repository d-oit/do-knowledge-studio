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
 * - no maintained doc presents localStorage as the persistence layer without
 *   naming IndexedDB as the canonical store (AGENTS.md drifted for months
 *   because only plan docs were checked);
 * - every export format in `export-types.ts` is named in the README;
 * - optional data-egress capabilities are labelled;
 * - PHASES history lines that mention SQLite are marked historical;
 * - `VERSION` matches the `package.json` version;
 * - README, `LICENSE` and `NOTICE` agree on the MIT license and name the
 *   project owner rather than the template's placeholder holder.
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
const agents = readFileSync('AGENTS.md', 'utf8')
const architecture = readFileSync('plans/ARCHITECTURE.md', 'utf8')
const goal = readFileSync('plans/GOAL.md', 'utf8')
const phases = readFileSync('plans/PHASES.md', 'utf8')
const types = readFileSync('src/lib/studio/types.ts', 'utf8')
const exportTypes = readFileSync('src/components/studio/views/export-types.ts', 'utf8')
const versionFile = readFileSync('VERSION', 'utf8').trim()
const license = readFileSync('LICENSE', 'utf8')
const notice = readFileSync('NOTICE', 'utf8')

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
    ['settings', 'Settings'],
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
  ['AGENTS.md', agents],
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
    // A persistence claim naming localStorage but not IndexedDB describes the
    // pre-#1036 world: the corpus moved to IndexedDB, leaving localStorage a
    // small metadata envelope. `AGENTS.md` is the first file a coding agent
    // reads, so a stale claim there is the most expensive kind of drift. A
    // line that says it is describing history may name the old store freely —
    // same escape hatch as the SQLite rule above.
    if (
      /persist/i.test(line) &&
      /localStorage/i.test(line) &&
      !/IndexedDB/i.test(line) &&
      !/historical|legacy|pre-#|formerly/i.test(line)
    ) {
      fail(`${name} presents localStorage as the persistence layer: ${line.trim()}`)
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

// --- License and version metadata -----------------------------------------
if (versionFile !== packageJson.version) {
  fail(
    `VERSION (${versionFile}) does not match package.json version (${packageJson.version})`,
  )
}

const licenseSectionStart = readme.indexOf('## License')
if (licenseSectionStart === -1) {
  fail('README is missing a "## License" section')
} else {
  const licenseSection = readme.slice(licenseSectionStart)
  if (!/MIT/.test(licenseSection)) {
    fail('README license section does not state the MIT license')
  }
  if (/Internal project/i.test(licenseSection)) {
    fail('README license section contradicts the MIT LICENSE')
  }
}

if (!/^MIT License/m.test(license)) {
  fail('LICENSE is not the MIT license text')
}
if (!/MIT License/.test(notice)) {
  fail('NOTICE does not state the MIT license')
}
for (const [name, text] of [
  ['LICENSE', license],
  ['NOTICE', notice],
]) {
  if (/AI Agent Template Contributors/.test(text)) {
    fail(`${name} still names the template copyright holder`)
  }
}

// --- Lesson index consistency (#1141, #1142) ---------------------------------
// The LESSONS.md index (one `- [LESSON-NNN: …](lessons/NNN-slug.md)` line per
// lesson), the agents-docs/lessons/ files, and lessons.jsonl rows must carry
// the same id set; index lines must be unique; the index stays under a 400
// line budget; every LESSON-NNN cited in AGENTS.md/agents-docs must exist.
const lessonsMd = readFileSync('agents-docs/LESSONS.md', 'utf8')
const LESSON_INDEX_BUDGET_LINES = 400
const indexLineCount = lessonsMd.split('\n').length
if (indexLineCount > LESSON_INDEX_BUDGET_LINES) {
  fail(`agents-docs/LESSONS.md index is ${indexLineCount} lines, over the ${LESSON_INDEX_BUDGET_LINES}-line budget (#1142)`)
}
const indexEntries = [...lessonsMd.matchAll(/^- \[(LESSON-\d+): [^\]]+\]\((lessons\/[^)]+)\)/gm)]
const lessonHeadingIds = []
for (const entry of indexEntries) {
  lessonHeadingIds.push(entry[1])
  const lessonFile = `agents-docs/${entry[2]}`
  let lessonText = ''
  try {
    lessonText = readFileSync(lessonFile, 'utf8')
  } catch {
    fail(`LESSONS.md index links to missing file: ${lessonFile}`)
    continue
  }
  if (!new RegExp(`^#{2,3} ${entry[1]}:`, 'm').test(lessonText)) {
    fail(`${lessonFile} does not contain its ${entry[1]} heading`)
  }
}
const duplicateHeadings = lessonHeadingIds.filter((id, i) => lessonHeadingIds.indexOf(id) !== i)
for (const id of [...new Set(duplicateHeadings)]) {
  fail(`agents-docs/LESSONS.md has a duplicate heading: ${id}`)
}
const jsonlIds = readFileSync('agents-docs/lessons.jsonl', 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line, i) => {
    try {
      return JSON.parse(line).id
    } catch {
      fail(`agents-docs/lessons.jsonl line ${i + 1} is not valid JSON`)
      return undefined
    }
  })
  .filter(Boolean)
const headingSet = new Set(lessonHeadingIds)
const jsonlSet = new Set(jsonlIds)
for (const id of lessonHeadingIds) {
  if (!jsonlSet.has(id)) fail(`LESSONS.md ${id} has no lessons.jsonl row`)
}
for (const id of jsonlIds) {
  if (!headingSet.has(id)) fail(`lessons.jsonl ${id} has no LESSONS.md heading`)
}
if (jsonlIds.length !== jsonlSet.size) {
  fail('agents-docs/lessons.jsonl has duplicate ids')
}
const knownLessons = new Set([...lessonHeadingIds, ...jsonlIds])
const citingFiles = ['AGENTS.md', ...readdirSync('agents-docs').filter((f) => f.endsWith('.md')).map((f) => `agents-docs/${f}`)]
for (const file of citingFiles) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/LESSON-(\d{3})/g)) {
    if (!knownLessons.has(match[0])) {
      fail(`${file} cites unknown lesson ${match[0]}`)
    }
  }
}

if (process.exitCode !== 1) {
  console.log('✓ Public documentation consistency checks passed')
}
