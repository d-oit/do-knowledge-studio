import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const SCORE_SCRIPT = resolve(TEST_DIRECTORY, '../../scripts/check-mutation-score.mjs')
const STRYKER_CONFIG = resolve(TEST_DIRECTORY, '../../stryker.config.json')
const PASSING_SCORE_NUMERATOR_PER_MODULE = 2
const PASSING_SCORE_DENOMINATOR_PER_MODULE = 3
const PASSING_TIMEOUT_MUTANTS = 2
const PASSING_NO_COVERAGE_MUTANTS = 1
const BELOW_FLOOR_KILLED_MUTANTS_PER_MODULE = 7
const BELOW_FLOOR_SURVIVED_MUTANTS_PER_MODULE = 5

const createPassingStatuses = (moduleCount: number): string[] => {
  const detected = moduleCount * PASSING_SCORE_NUMERATOR_PER_MODULE
  const total = moduleCount * PASSING_SCORE_DENOMINATOR_PER_MODULE
  const killed = detected - PASSING_TIMEOUT_MUTANTS
  const survived = total - detected - PASSING_NO_COVERAGE_MUTANTS
  return [
    ...Array.from({ length: killed }, () => 'Killed'),
    ...Array.from({ length: PASSING_TIMEOUT_MUTANTS }, () => 'Timeout'),
    ...Array.from({ length: survived }, () => 'Survived'),
    'NoCoverage',
  ]
}

const createBelowFloorStatuses = (moduleCount: number): string[] => [
  ...Array.from({ length: moduleCount * BELOW_FLOOR_KILLED_MUTANTS_PER_MODULE }, () => 'Killed'),
  ...Array.from({ length: moduleCount * BELOW_FLOOR_SURVIVED_MUTANTS_PER_MODULE }, () => 'Survived'),
]

const readMutationScope = async (): Promise<string[]> => {
  const config: unknown = JSON.parse(await readFile(STRYKER_CONFIG, 'utf8'))
  if (typeof config !== 'object' || config === null || !('mutate' in config) || !Array.isArray(config.mutate)) {
    throw new Error('stryker.config.json must define a string-array mutate scope')
  }
  const mutationEntries: unknown[] = config.mutate
  const files: string[] = []
  for (const file of mutationEntries) {
    if (typeof file !== 'string') throw new Error('stryker.config.json mutate entries must be strings')
    files.push(file)
  }
  return files
}

let mutationFiles: string[] = []

const createReport = (sourceFile: string, statuses: readonly string[]) => ({
  files: {
    [sourceFile]: {
      mutants: statuses.map((status, index) => ({ id: String(index), status })),
    },
  },
})

const createShardReports = (statuses: readonly string[], files: readonly string[] = mutationFiles) => {
  if (files.length === 0) throw new Error('Mutation report fixtures need at least one source file')
  const statusesByFile = new Map<string, string[]>()
  for (const file of files) statusesByFile.set(file, [])
  statuses.forEach((status, index) => {
    const sourceFile = files[index % files.length]
    if (sourceFile === undefined) throw new Error('Mutation report fixture has no source file')
    const fileStatuses = statusesByFile.get(sourceFile)
    if (fileStatuses === undefined) throw new Error(`Missing status bucket for ${sourceFile}`)
    fileStatuses.push(status)
  })

  return [...statusesByFile.entries()].map(([sourceFile, fileStatuses]) => {
    if (fileStatuses.length === 0) throw new Error(`Mutation report fixture has no mutants for ${sourceFile}`)
    return createReport(sourceFile, fileStatuses)
  })
}

const runScoreCheck = (reports: unknown) => {
  const input = JSON.stringify(reports)
  if (input === undefined) throw new Error('Mutation report fixture could not be serialized')
  const result = spawnSync(process.execPath, [SCORE_SCRIPT], { encoding: 'utf8', input })
  if (result.error) throw result.error
  return result
}

beforeEach(async () => {
  mutationFiles = await readMutationScope()
})

describe('mutation score report aggregation', () => {
  it('combines module reports and counts timeouts as detected mutants', () => {
    const reports = createShardReports(createPassingStatuses(mutationFiles.length))
    const result = runScoreCheck(reports)
    const detected = mutationFiles.length * PASSING_SCORE_NUMERATOR_PER_MODULE
    const total = mutationFiles.length * PASSING_SCORE_DENOMINATOR_PER_MODULE

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      `Mutation score 66.67% (floor 60%; ${detected}/${total} detected`,
    )
    expect(result.stdout).toContain('timeout 2')
    expect(result.stdout).toContain('no coverage 1')
  })

  it('accepts the full Stryker report used by the local command', () => {
    const report = {
      files: Object.fromEntries(mutationFiles.map((sourceFile, index) => [
        sourceFile,
        { mutants: [{ id: String(index), status: 'Killed' }] },
      ])),
    }
    const result = runScoreCheck(report)
    const totalMutants = mutationFiles.length

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      `Mutation score 100.00% (floor 60%; ${totalMutants}/${totalMutants} detected`,
    )
  })

  it('fails when the aggregate score is below the floor', () => {
    const reports = createShardReports(createBelowFloorStatuses(mutationFiles.length))
    const result = runScoreCheck(reports)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Aggregate mutation score 58.33% is below 60%')
  })

  it('fails when a configured module report is missing', () => {
    const missingFile = mutationFiles.at(-1)
    if (missingFile === undefined) throw new Error('Mutation report fixture scope was not initialized')
    const availableFiles = mutationFiles.slice(0, -1)
    const reports = createShardReports(availableFiles.map(() => 'Killed'), availableFiles)
    const result = runScoreCheck(reports)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`Missing mutation reports for configured files: ${missingFile}`)
  })

  it('fails when a module appears in more than one report', () => {
    const firstFile = mutationFiles[0]
    if (firstFile === undefined) throw new Error('Mutation report fixture scope was not initialized')
    const reports = createShardReports(mutationFiles.map(() => 'Killed'))
    reports.push(createReport(firstFile, ['Killed']))
    const result = runScoreCheck(reports)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`Duplicate mutation report for '${firstFile}'`)
  })

  it('fails on mutation errors instead of counting them in the score', () => {
    const reports = createShardReports(['CompileError', ...mutationFiles.slice(1).map(() => 'Killed')])
    const result = runScoreCheck(reports)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('1 mutants had an error, pending, ignored, or unknown status')
  })
})
