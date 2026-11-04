import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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

let temporaryDirectory: string | undefined
let mutationFiles: string[] = []

const writeReport = async (filePath: string, sourceFile: string, statuses: readonly string[]): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true })
  const report = {
    files: {
      [sourceFile]: {
        mutants: statuses.map((status, index) => ({ id: String(index), status })),
      },
    },
  }
  await writeFile(filePath, JSON.stringify(report), 'utf8')
}

const writeShardReports = async (
  directory: string,
  statuses: readonly string[],
  files: readonly string[] = mutationFiles,
): Promise<void> => {
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

  for (const [index, [sourceFile, fileStatuses]] of [...statusesByFile.entries()].entries()) {
    if (fileStatuses.length === 0) throw new Error(`Mutation report fixture has no mutants for ${sourceFile}`)
    const reportPath = join(directory, `mutation-${index}`, 'reports', 'mutation.json')
    await writeReport(reportPath, sourceFile, fileStatuses)
  }
}

const runScoreCheck = (source: string) => {
  const result = spawnSync(process.execPath, [SCORE_SCRIPT, source], { encoding: 'utf8' })
  if (result.error) throw result.error
  return result
}

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'dks-mutation-score-'))
  mutationFiles = await readMutationScope()
})

afterEach(async () => {
  if (temporaryDirectory !== undefined) {
    await rm(temporaryDirectory, { recursive: true, force: true })
    temporaryDirectory = undefined
  }
})

describe('mutation score report aggregation', () => {
  it('combines module reports and counts timeouts as detected mutants', async () => {
    const source = temporaryDirectory
    if (source === undefined) throw new Error('Mutation report fixture directory was not initialized')
    await writeShardReports(source, createPassingStatuses(mutationFiles.length))

    const result = runScoreCheck(source)
    const detected = mutationFiles.length * PASSING_SCORE_NUMERATOR_PER_MODULE
    const total = mutationFiles.length * PASSING_SCORE_DENOMINATOR_PER_MODULE

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      `Mutation score 66.67% (floor 60%; ${detected}/${total} detected`,
    )
    expect(result.stdout).toContain('timeout 2')
    expect(result.stdout).toContain('no coverage 1')
  })

  it('accepts the full Stryker report file used by the local command', async () => {
    const source = temporaryDirectory
    if (source === undefined) throw new Error('Mutation report fixture directory was not initialized')
    const reportFile = join(source, 'mutation.json')
    const report = {
      files: Object.fromEntries(mutationFiles.map((sourceFile, index) => [
        sourceFile,
        { mutants: [{ id: String(index), status: 'Killed' }] },
      ])),
    }
    await writeFile(reportFile, JSON.stringify(report), 'utf8')

    const result = runScoreCheck(reportFile)
    const totalMutants = mutationFiles.length

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      `Mutation score 100.00% (floor 60%; ${totalMutants}/${totalMutants} detected`,
    )
  })

  it('fails when the aggregate score is below the floor', async () => {
    const source = temporaryDirectory
    if (source === undefined) throw new Error('Mutation report fixture directory was not initialized')
    await writeShardReports(source, createBelowFloorStatuses(mutationFiles.length))

    const result = runScoreCheck(source)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Aggregate mutation score 58.33% is below 60%')
  })

  it('fails when a configured module report is missing', async () => {
    const source = temporaryDirectory
    const missingFile = mutationFiles.at(-1)
    if (source === undefined || missingFile === undefined) {
      throw new Error('Mutation report fixture scope was not initialized')
    }
    const availableFiles = mutationFiles.slice(0, -1)
    await writeShardReports(source, availableFiles.map(() => 'Killed'), availableFiles)

    const result = runScoreCheck(source)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`Missing mutation reports for configured files: ${missingFile}`)
  })

  it('fails when a module appears in more than one report', async () => {
    const source = temporaryDirectory
    const firstFile = mutationFiles[0]
    if (source === undefined || firstFile === undefined) {
      throw new Error('Mutation report fixture scope was not initialized')
    }
    await writeShardReports(source, mutationFiles.map(() => 'Killed'))
    await writeReport(join(source, 'duplicate', 'reports', 'mutation.json'), firstFile, ['Killed'])

    const result = runScoreCheck(source)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`Duplicate mutation report for '${firstFile}'`)
  })

  it('fails on mutation errors instead of counting them in the score', async () => {
    const source = temporaryDirectory
    if (source === undefined) throw new Error('Mutation report fixture directory was not initialized')
    await writeShardReports(source, ['CompileError', ...mutationFiles.slice(1).map(() => 'Killed')])

    const result = runScoreCheck(source)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('1 mutants had an error, pending, ignored, or unknown status')
  })
})
