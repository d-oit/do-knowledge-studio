#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const BASE_REF_ARGUMENT_INDEX = 2
const EXPECTED_ARGUMENT_COUNT = 3

const EXIT_CODE_GUARD_FAILED = 1
const EXIT_CODE_ERROR = 2

const git = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const listPaths = (args) => git(args).split('\0').filter(Boolean)
const describeError = (error) => (error instanceof Error ? error.message : String(error))

const main = () => {
  const baseRef = process.argv[BASE_REF_ARGUMENT_INDEX]
  if (!baseRef || process.argv.length !== EXPECTED_ARGUMENT_COUNT) {
    console.error('Usage: node scripts/check-stale-base-deletions.mjs <base-ref>')
    process.exitCode = EXIT_CODE_ERROR
    return
  }

  try {
    const baseCommit = git(['rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`]).trim()
    const mergeBase = git(['merge-base', baseCommit, 'HEAD']).trim()
    if (!mergeBase) throw new Error(`No merge base found for ${baseRef} and HEAD`)

    const baseAdditions = new Set(
      listPaths(['diff', '--no-renames', '--diff-filter=A', '--name-only', '-z', mergeBase, baseCommit]),
    )
    const headDeletions = listPaths([
      'diff',
      '--no-renames',
      '--diff-filter=D',
      '--name-only',
      '-z',
      baseCommit,
      'HEAD',
    ])
    const missingBaseAdditions = headDeletions.filter((path) => baseAdditions.has(path))

    if (missingBaseAdditions.length > 0) {
      console.error(`Stale base: HEAD is missing files added to ${baseRef} since merge base ${mergeBase}:`)
      for (const path of missingBaseAdditions) console.error(`  ${JSON.stringify(path)}`)
      process.exitCode = EXIT_CODE_GUARD_FAILED
      return
    }

    console.log(`No files added to ${baseRef} since merge base ${mergeBase} are missing from HEAD.`)
  } catch (error) {
    console.error(`Unable to check stale-base deletions: ${describeError(error)}`)
    process.exitCode = EXIT_CODE_ERROR
  }
}

main()
