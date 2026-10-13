#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import semver from 'semver'

const BASE_REF_ARGUMENT_INDEX = 2
const EXPECTED_ARGUMENT_COUNT = 3

const EXIT_CODE_GUARD_FAILED = 1
const EXIT_CODE_ERROR = 2

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies']

const describeError = (error) => (error instanceof Error ? error.message : String(error))

const git = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const parseManifest = (content, source) => {
  let manifest
  try {
    manifest = JSON.parse(content)
  } catch (error) {
    throw new Error(`${source} is not valid JSON: ${describeError(error)}`)
  }

  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`${source} must contain a JSON object`)
  }

  const dependencies = new Map()
  for (const section of DEPENDENCY_SECTIONS) {
    const values = manifest[section]
    if (values === undefined) continue
    if (values === null || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error(`${source} field ${section} must be an object`)
    }
    for (const [name, range] of Object.entries(values)) {
      if (typeof range !== 'string') {
        throw new Error(`${source} dependency ${name} must have a string version range`)
      }
      dependencies.set(name, range)
    }
  }
  return dependencies
}
const minimumVersion = (range) => {
  try {
    return semver.minVersion(range)
  } catch {
    return null
  }
}

const main = () => {
  const baseRef = process.argv[BASE_REF_ARGUMENT_INDEX]
  if (!baseRef || process.argv.length !== EXPECTED_ARGUMENT_COUNT) {
    console.error('Usage: node scripts/check-dependency-downgrades.mjs <base-ref>')
    process.exitCode = EXIT_CODE_ERROR
    return
  }

  try {
    const baseCommit = git(['rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`]).trim()
    const baseContent = git(['show', `${baseCommit}:package.json`])
    const baseDependencies = parseManifest(baseContent, `${baseRef}:package.json`)
    const currentDependencies = parseManifest(readFileSync('package.json', 'utf8'), 'package.json')
    const failures = []

    for (const [name, baseRange] of baseDependencies) {
      const currentRange = currentDependencies.get(name)
      if (currentRange === undefined || currentRange === baseRange) continue

      const baseMinimum = minimumVersion(baseRange)
      const currentMinimum = minimumVersion(currentRange)
      if (baseMinimum === null || currentMinimum === null) {
        failures.push(
          `Cannot compare ${name} range ${JSON.stringify(baseRange)} -> ${JSON.stringify(currentRange)}; manual review required.`,
        )
      } else if (semver.lt(currentMinimum, baseMinimum)) {
        failures.push(
          `Dependency downgrade: ${name} ${baseRange} -> ${currentRange} (minimum ${baseMinimum.version} -> ${currentMinimum.version}).`,
        )
      }
    }

    if (failures.length > 0) {
      for (const failure of failures) console.error(failure)
      process.exitCode = EXIT_CODE_GUARD_FAILED
      return
    }

    console.log(`No dependency downgrades detected against ${baseRef}.`)
  } catch (error) {
    console.error(`Unable to compare dependency ranges: ${describeError(error)}`)
    process.exitCode = EXIT_CODE_ERROR
  }
}

main()
