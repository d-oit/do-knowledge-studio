#!/usr/bin/env node
/**
 * Compare benchmark-guard durations against a recorded baseline.
 *
 * Input is the JSON report from `pnpm run test:bench -- --reporter=json`
 * (the exported `it()` perf guards; Vitest does not emit `bench()` results
 * through this reporter). The report carries a wall-clock `duration` per
 * assertion, which is machine-dependent — so this check deliberately warns
 * only on an order-of-magnitude regression, not on percentage drift. Shared
 * CI runners cannot support a tighter bound than that.
 *
 * Usage:
 *   node scripts/check-bench-baseline.mjs <report.json>
 *   node scripts/check-bench-baseline.mjs <report.json> --update
 *   node scripts/check-bench-baseline.mjs <report.json> --enforce
 *
 * `--update` rewrites the baseline from the report (record it on the runner
 * class that will compare against it). Without `--enforce`, regressions and
 * new guards are warnings and the exit code stays 0; a failed guard always
 * exits 1 because the guard's own assertion already failed for a reason.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'

const DEFAULT_BASELINE_PATH = 'plans/bench-baselines.json'

/** A duration must exceed this multiple of its baseline to be reported. */
const MAX_REGRESSION_FACTOR = 10

/** Guards faster than this are dominated by timer noise on shared runners. */
const NOISE_FLOOR_MS = 5

/** Baseline file shape; `entries` is keyed by the assertion's full name. */
const BASELINE_FORMAT_VERSION = 1

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

/** Flattens a Vitest JSON report into the guards this script compares. */
const collectGuards = (report) => {
  const guards = []
  for (const file of report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      guards.push({
        name: assertion.fullName ?? assertion.title,
        file: file.name,
        status: assertion.status,
        ms: assertion.duration ?? 0,
      })
    }
  }
  return guards
}

const formatMs = (value) => `${value.toFixed(1)} ms`

const compare = (guards, baseline) => {
  const warnings = []
  const notices = []
  for (const guard of guards) {
    if (guard.status !== 'passed') {
      warnings.push(`FAILED guard: ${guard.name} (${guard.file})`)
      continue
    }
    const recorded = baseline.entries[guard.name]
    if (recorded === undefined) {
      notices.push(`new guard with no baseline: ${guard.name} (${formatMs(guard.ms)})`)
      continue
    }
    if (recorded.ms < NOISE_FLOOR_MS) continue
    const factor = guard.ms / recorded.ms
    if (factor >= MAX_REGRESSION_FACTOR) {
      warnings.push(
        `REGRESSION ${factor.toFixed(1)}x: ${guard.name} ` +
          `(${formatMs(recorded.ms)} -> ${formatMs(guard.ms)})`,
      )
    }
  }
  return { warnings, notices }
}

const buildBaseline = (guards) => ({
  formatVersion: BASELINE_FORMAT_VERSION,
  capturedAt: new Date().toISOString(),
  note:
    'Wall-clock durations of the exported benchmark guards. Shared-runner and ' +
    'cross-machine timings vary; the comparator warns only at an ' +
    `${MAX_REGRESSION_FACTOR}x factor. Refresh with --update on the runner class ` +
    'that compares against it.',
  entries: Object.fromEntries(
    guards
      .filter((guard) => guard.status === 'passed')
      // Store a repository-relative path so the baseline does not bake in the
      // machine directory it happened to be captured from.
      .map((guard) => [guard.name, { ms: guard.ms, file: relative(process.cwd(), guard.file) }]),
  ),
})

const main = (argv) => {
  const reportPath = argv[0]
  if (reportPath === undefined) {
    console.error('usage: node scripts/check-bench-baseline.mjs <report.json> [--update] [--enforce]')
    return 2
  }
  const update = argv.includes('--update')
  const enforce = argv.includes('--enforce')
  const baselinePath = DEFAULT_BASELINE_PATH

  const guards = collectGuards(readJson(reportPath))
  if (guards.length === 0) {
    console.error(`no benchmark guards found in ${reportPath}`)
    return 1
  }

  if (update) {
    writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(guards), null, 2)}\n`)
    console.log(`wrote ${guards.length} guard baselines to ${baselinePath}`)
    return 0
  }

  let baseline
  try {
    baseline = readJson(baselinePath)
  } catch (error) {
    console.error(`cannot read baseline ${baselinePath}: ${error.message}`)
    return 1
  }
  if (baseline.formatVersion !== BASELINE_FORMAT_VERSION) {
    console.error(`unsupported baseline format ${baseline.formatVersion}`)
    return 1
  }

  const { warnings, notices } = compare(guards, baseline)
  for (const notice of notices) console.log(`notice: ${notice}`)
  for (const warning of warnings) console.warn(`warning: ${warning}`)

  if (warnings.length === 0) {
    console.log(`benchmark guards within ${MAX_REGRESSION_FACTOR}x of baseline (${guards.length} guards)`)
    return 0
  }
  console.warn(`${warnings.length} benchmark baseline warning(s)`)
  return enforce ? 1 : 0
}

process.exitCode = main(process.argv.slice(2))
