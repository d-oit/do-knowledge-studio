#!/usr/bin/env node
/** Ratchet: fail when persistence/sync coverage drops (Plan 214 #1132). */
import { readFileSync, existsSync } from 'node:fs'

const SUMMARY_PATH = 'coverage/coverage-summary.json'
const FLOORS = {
  'src/lib/studio': { lines: 80, branches: 70 },
  'src/lib/sync': { lines: 70, branches: 60 },
}
const MAX_DROP_PP = 0.5

if (!existsSync(SUMMARY_PATH)) {
  console.log('Coverage summary not found — run pnpm run test:coverage first. Skipping ratchet.')
  process.exit(0)
}

const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'))
const aggregate = (prefix) => {
  let linesTotal = 0
  let linesCovered = 0
  let branchesTotal = 0
  let branchesCovered = 0
  for (const [file, data] of Object.entries(summary)) {
    if (file === 'total' || !file.startsWith(prefix)) continue
    linesTotal += data.lines.total
    linesCovered += data.lines.covered
    branchesTotal += data.branches.total
    branchesCovered += data.branches.covered
  }
  return {
    lines: linesTotal === 0 ? 100 : (linesCovered / linesTotal) * 100,
    branches: branchesTotal === 0 ? 100 : (branchesCovered / branchesTotal) * 100,
  }
}

let failed = false
for (const [prefix, floor] of Object.entries(FLOORS)) {
  const actual = aggregate(prefix)
  console.log(`${prefix}: lines ${actual.lines.toFixed(2)}% (floor ${floor.lines}%), branches ${actual.branches.toFixed(2)}% (floor ${floor.branches}%)`)
  if (actual.lines + MAX_DROP_PP < floor.lines || actual.branches + MAX_DROP_PP < floor.branches) {
    console.error(`Ratchet failed for ${prefix}`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log('Coverage ratchet passed.')
