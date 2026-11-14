#!/usr/bin/env node
/**
 * GitHub Actions workflow hygiene gate (Issue #1140).
 *
 * A check that cannot fail is worse than none (LESSON-046/047). This gate makes
 * three workflow rules enforceable instead of prose:
 *
 * 1. Every `continue-on-error: true` carries an adjacent
 *    `# allow-continue-on-error: <reason>` comment, so a deliberate bypass is
 *    distinguishable from a forgotten one.
 * 2. Every workflow triggered by `push`, `pull_request` or
 *    `pull_request_target` declares a `concurrency` group, so repeated pushes
 *    do not queue redundant runs (LESSON-048/049).
 * 3. Every workflow declares top-level `permissions` (least privilege).
 *
 * Usage: node scripts/check-workflow-hygiene.mjs [workflowDir]
 * Exit 0 when clean; non-zero with one line per violation.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DEFAULT_DIR = join(REPO_ROOT, '.github', 'workflows')
const ALLOW_MARKER = '# allow-continue-on-error:'
const CONCURRENCY_TRIGGERS = new Set(['push', 'pull_request', 'pull_request_target'])
const CONTINUE_ON_ERROR = /^\s*continue-on-error:\s*true\s*(#.*)?$/

/** Normalizes the `on:` key, which YAML 1.1 parsers may read as boolean `true`. */
const triggersOf = (doc) => {
  const on = doc.on ?? doc.true
  if (typeof on === 'string') return [on]
  if (Array.isArray(on)) return on
  if (on !== null && typeof on === 'object') return Object.keys(on)
  return []
}

/** Returns one message per hygiene violation in a single workflow file. */
const checkWorkflow = (path, text) => {
  const problems = []
  let doc
  try {
    doc = parse(text)
  } catch (error) {
    return [`${path}: invalid YAML: ${error.message}`]
  }
  if (doc === null || typeof doc !== 'object') return [`${path}: not a YAML mapping`]

  if (!('permissions' in doc)) problems.push(`${path}: missing top-level permissions`)

  const triggers = triggersOf(doc)
  const needsConcurrency = triggers.some((trigger) => CONCURRENCY_TRIGGERS.has(trigger))
  if (needsConcurrency) {
    if (!('concurrency' in doc)) {
      problems.push(
        `${path}: triggered by ${triggers.join(', ')} but declares no concurrency group`,
      )
    } else if (!doc.concurrency?.group) {
      problems.push(`${path}: concurrency block has no group`)
    }
  }

  const lines = text.split('\n')
  lines.forEach((line, index) => {
    if (!CONTINUE_ON_ERROR.test(line)) return
    const previous = index > 0 ? lines[index - 1] : ''
    if (line.includes(ALLOW_MARKER) || previous.includes(ALLOW_MARKER)) return
    problems.push(
      `${path}:${index + 1}: continue-on-error: true needs an adjacent ` +
        `'${ALLOW_MARKER} <reason>' comment`,
    )
  })

  return problems
}

const main = () => {
  const target = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_DIR
  let entries
  try {
    entries = readdirSync(target)
  } catch (error) {
    console.error(`check-workflow-hygiene: cannot read ${target}: ${error.message}`)
    process.exit(2)
  }

  const files = entries
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .filter((name) => statSync(join(target, name)).isFile())
    .sort()

  const problems = files.flatMap((name) => {
    const path = join(target, name)
    return checkWorkflow(path, readFileSync(path, 'utf8'))
  })

  if (problems.length > 0) {
    for (const problem of problems) console.error(problem)
    console.error(`\ncheck-workflow-hygiene: ${problems.length} violation(s)`)
    process.exit(1)
  }
  console.log(`check-workflow-hygiene: ${files.length} workflow(s) clean`)
}

main()
