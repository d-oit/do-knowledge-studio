#!/usr/bin/env node
/** Fail when a non-test source file exceeds 500 lines (AGENTS.md limit). */
import { existsSync, opendirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { readTextFile } from './lib/read-text.mjs'

const MAX_LOC = 500
const WARN_LOC = 450
const ROOTS = ['src', 'packages']
const ALLOWLIST_FILE = 'scripts/file-size-allowlist.txt'
const TEST_PATTERN = /\.test\.[^.]+$|\.bench\.[^.]+$|\.spec\.[^.]+$/
const REPO_ROOT = resolve(process.cwd())

// Traversal inputs are repo constants, but every joined path is still
// resolved and contained before it reaches fs: a hostile or exotic entry
// name (separator, NUL, dot-segment, symlink escape) is skipped instead of
// followed outside the walk root.
const isWithin = (base, candidate) => candidate === base || candidate.startsWith(base + sep)
const isSafeEntry = (entry) =>
  entry !== '' &&
  entry !== '.' &&
  entry !== '..' &&
  !entry.includes('/') &&
  !entry.includes('\\') &&
  !entry.includes('\0')

const listEntries = (directory) => {
  const entries = []
  const dir = opendirSync(directory)
  try {
    for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) entries.push(entry)
  } finally {
    dir.closeSync()
  }
  return entries
}

const allowlist = new Set()
if (existsSync(ALLOWLIST_FILE)) {
  for (const line of readFileSync(ALLOWLIST_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed !== '' && !trimmed.startsWith('#')) allowlist.add(trimmed)
  }
}

const collectFiles = (dir, rootBase, out) => {
  const resolvedDir = resolve(dir)
  if (!isWithin(rootBase, resolvedDir)) return out
  let entries
  try {
    entries = listEntries(resolvedDir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const name = entry.name
    if (!isSafeEntry(name)) continue
    const full = join(resolvedDir, name)
    if (!isWithin(rootBase, full) || entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      collectFiles(full, rootBase, out)
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const rootEntries = new Map(listEntries(REPO_ROOT).map((entry) => [entry.name, entry]))
const failures = []
const warnings = []
for (const root of ROOTS) {
  const rootEntry = rootEntries.get(root)
  if (!rootEntry?.isDirectory() || rootEntry.isSymbolicLink()) continue
  const rootBase = resolve(REPO_ROOT, root)
  if (!isWithin(REPO_ROOT, rootBase)) continue
  for (const file of collectFiles(rootBase, rootBase, [])) {
    if (TEST_PATTERN.test(file)) continue
    const rel = relative(REPO_ROOT, file)
    if (rel.includes('/ui/') && rel.startsWith('src/components/ui/')) continue
    if (allowlist.has(rel)) continue
    const lines = (await readTextFile(file)).split('\n').length
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
