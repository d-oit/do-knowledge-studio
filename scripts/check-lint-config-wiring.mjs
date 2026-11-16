#!/usr/bin/env node
/**
 * Lint-config wiring check (LESSON-047).
 *
 * `lint_if_changed(file, tool, config, cmd...)` hashes `config` into the
 * cache key but never appends it to the command — a call site that names a
 * config file without forwarding it (e.g. `--config <file>`) lints with
 * stock rules while looking configured. This check fails on any such site.
 *
 * Tools whose config is auto-discovered from the file's directory (no flag
 * needed) are allowlisted with the reason in AUTODISCOVERED.
 *
 * Exit 0 when every call site is wired; non-zero with one line per drift.
 */
import { normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextFile } from './lib/read-text.mjs'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))

/** tool -> config filename that needs no flag (auto-discovered). */
const AUTODISCOVERED = new Map([
  ['shellcheck', '.shellcheckrc'],
])

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}

const SHELL_EXTENSION = '.sh'

// Targets come from argv (fixture-testable), so validate each shape before
// handing it to fs: reject NUL bytes and non-shell targets, then normalize.
const resolveTarget = (raw) => {
  if (typeof raw !== 'string' || raw.length === 0 || raw.includes('\0')) {
    fail('refusing to read an invalid target path')
    return null
  }
  const resolved = resolve(normalize(raw))
  if (!resolved.endsWith(SHELL_EXTENSION)) {
    fail(`${raw} is not a shell library (${SHELL_EXTENSION} expected)`)
    return null
  }
  return resolved
}

// Join backslash continuations so multi-line invocations parse as one.
// Optional argv paths make the check fixture-testable; default is the repo's
// language-checks library.
const rawTargets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['scripts/lib/language-checks.sh']
const targets = rawTargets.map(resolveTarget).filter((target) => target !== null)
if (targets.length !== rawTargets.length) {
  process.exit(1)
}
const sources = await Promise.all(
  targets.map(async (path) => ({
    path,
    text: (await readTextFile(path)).replace(/\\\n/g, ' '),
  })),
)

for (const { path, text } of sources) {
  for (const match of text.matchAll(/lint_if_changed\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]*)"\s*([^;\n]*)/g)) {
    const [, file, tool, config, command] = match
    if (config === '') continue
    if (AUTODISCOVERED.get(tool) === config) continue
    if (!command.includes('--config')) {
      fail(`${path}: lint_if_changed for ${tool} names config "${config}" but the command for ${file} has no --config flag`)
    } else if (!command.includes(config)) {
      fail(`${path}: lint_if_changed for ${tool} passes --config but not "${config}" in the command for ${file}`)
    }
  }
}

if (process.exitCode !== 1) {
  console.log('✓ Lint-config wiring checks passed')
}
