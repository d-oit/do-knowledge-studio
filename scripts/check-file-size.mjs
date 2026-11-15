#!/usr/bin/env node
/** Fail when a non-test source file exceeds 500 lines (AGENTS.md limit). */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const MAX_LOC = 500
const WARN_LOC = 450
const ROOTS = ['src', 'packages']
const ALLOWLIST_FILE = 'scripts/file-size-allowlist.txt'
const TEST_PATTERN = /\.test\.[^.]+$|\.bench\.[^.]+$|\.spec\.[^.]+$/

const allowlist = new Set()
if (existsSync(ALLOWLIST_FILE)) {
  for (const line of readFileSync(ALLOWLIST_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed !== '' && !trimmed.startsWith('#')) allowlist.add(trimmed)
  }
}

const collectFiles = (dir, out) => {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      collectFiles(full, out)
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const failures = []
const warnings = []
for (const root of ROOTS) {
  if (!existsSync(root)) continue
  for (const file of collectFiles(root, [])) {
    if (TEST_PATTERN.test(file)) continue
    if (file.includes('/ui/') && file.startsWith('src/components/ui/')) continue
    const rel = relative(process.cwd(), file)
    if (allowlist.has(rel)) continue
    const lines = readFileSync(file, 'utf8').split('\n').length
    if (lines > MAX_LOC) failures.push(`${rel}: ${lines} lines (limit ${MAX_LOC})`)
    else if (lines >= WARN_LOC) warnings.push(`${rel}: ${lines} lines (warn at ${WARN_LOC})`)
  }
}

for (const warning of warnings) console.warn(`warn: ${warning}`)
if (failures.length > 0) {
  console.error(`File-size gate failed:\n${failures.join('\n')}`)
  process.exit(1)
}
console.log('File-size gate passed.')
