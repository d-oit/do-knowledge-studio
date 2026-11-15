#!/usr/bin/env node
/**
 * Lessons automation report (#1142).
 *
 * Lists every lessons.jsonl row with `automated_by: null`, grouped by its
 * first tag (proxy for the `root_cause` cluster) and sorted by recurrence,
 * so the next check to write is the one that kills the most prose.
 *
 * Report-only: always exits 0. CI runs it for visibility; the gate stays
 * green while the backlog exists.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))

const rows = readFileSync('agents-docs/lessons.jsonl', 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => JSON.parse(line))

const unautomated = rows.filter((row) => row.automated_by === null || row.automated_by === undefined)
const automated = rows.length - unautomated.length

const byCluster = new Map()
for (const row of unautomated) {
  const cluster = (row.tags ?? [])[0] ?? '(untagged)'
  if (!byCluster.has(cluster)) byCluster.set(cluster, [])
  byCluster.get(cluster).push(row)
}

const ranked = [...byCluster.entries()].sort((a, b) => b[1].length - a[1].length)

console.log(`Lessons automation report: ${automated}/${rows.length} automated, ${unautomated.length} prose-only`)
console.log('')
for (const [cluster, clusterRows] of ranked) {
  console.log(`#${cluster} — ${clusterRows.length} unautomated`)
  for (const row of clusterRows) {
    console.log(`  ${row.id}: ${row.title ?? '(untitled)'}`)
  }
}
