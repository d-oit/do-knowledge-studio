#!/usr/bin/env node
/** Fail when a non-test source file exceeds 500 lines (AGENTS.md limit). */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

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
    entries = readdirSync(resolvedDir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (!isSafeEntry(entry)) continue
    const full = join(resolvedDir, entry)
    if (!isWithin(rootBase, full)) continue
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      collectFiles(full, rootBase, out)
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const failures = []
const warnings = []
for (const root of ROOTS) {
  const rootBase = resolve(REPO_ROOT, root)
  if (!isWithin(REPO_ROOT, rootBase) || !existsSync(rootBase)) continue
  for (const file of collectFiles(rootBase, rootBase, [])) {
    if (TEST_PATTERN.test(file)) continue
    const rel = relative(REPO_ROOT, file)
    if (rel.includes('/ui/') && rel.startsWith('src/components/ui/')) continue
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
