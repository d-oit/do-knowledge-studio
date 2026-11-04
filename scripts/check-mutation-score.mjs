import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const DEFAULT_REPORT_SOURCE = 'reports/mutation.json'
const MUTATION_SCORE_FLOOR = 60
const PERCENT_SCALE = 100
const RECOGNIZED_STATUSES = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage'])

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const findMutationReports = async (directory) => {
  const reports = []
  const visit = async (currentDirectory) => {
    const entries = await readdir(currentDirectory, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = resolve(currentDirectory, entry.name)
      if (entry.isDirectory()) {
        await visit(entryPath)
      } else if (entry.isFile() && entry.name === 'mutation.json') {
        reports.push(entryPath)
      }
    }
  }
  await visit(directory)
  return reports
}

const loadReportPaths = async (sourcePath) => {
  const sourceInfo = await stat(sourcePath)
  if (sourceInfo.isFile()) return [sourcePath]
  if (!sourceInfo.isDirectory()) {
    throw new Error(`Mutation report source is neither a file nor a directory: ${sourcePath}`)
  }
  const reports = await findMutationReports(sourcePath)
  if (reports.length === 0) throw new Error(`No reports/mutation.json files found under ${sourcePath}`)
  return reports
}

const main = async () => {
  const args = process.argv.slice(2)
  if (args.length > 1) throw new Error('Usage: node scripts/check-mutation-score.mjs [report-file-or-directory]')

  const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const sourcePath = resolve(projectRoot, args[0] ?? DEFAULT_REPORT_SOURCE)
  const config = await readJson(new URL('../stryker.config.json', import.meta.url))
  if (!isRecord(config) || !Array.isArray(config.mutate) || config.mutate.some((file) => typeof file !== 'string')) {
    throw new Error('stryker.config.json must define a string-array mutate scope')
  }

  const expectedFiles = new Set(config.mutate)
  if (expectedFiles.size !== config.mutate.length || expectedFiles.size === 0) {
    throw new Error('stryker.config.json mutate scope must contain unique source files')
  }

  const reportPaths = await loadReportPaths(sourcePath)
  const seenFiles = new Set()
  const counts = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0 }
  let invalidMutants = 0

  for (const reportPath of reportPaths) {
    const report = await readJson(reportPath)
    if (!isRecord(report) || !isRecord(report.files)) {
      throw new Error(`Invalid Stryker report structure: ${reportPath}`)
    }

    for (const [file, fileReport] of Object.entries(report.files)) {
      if (!expectedFiles.has(file)) throw new Error(`Unexpected mutation scope entry '${file}' in ${reportPath}`)
      if (seenFiles.has(file)) throw new Error(`Duplicate mutation report for '${file}'`)
      if (!isRecord(fileReport) || !Array.isArray(fileReport.mutants) || fileReport.mutants.length === 0) {
        throw new Error(`Mutation report for '${file}' has no mutant results`)
      }
      seenFiles.add(file)

      for (const mutant of fileReport.mutants) {
        if (!isRecord(mutant) || typeof mutant.status !== 'string') {
          throw new Error(`Malformed mutant result for '${file}' in ${reportPath}`)
        }
        if (!RECOGNIZED_STATUSES.has(mutant.status)) {
          invalidMutants += 1
          continue
        }
        counts[mutant.status] += 1
      }
    }
  }

  const missingFiles = [...expectedFiles].filter((file) => !seenFiles.has(file))
  if (missingFiles.length > 0) {
    throw new Error(`Missing mutation reports for configured files: ${missingFiles.join(', ')}`)
  }
  if (invalidMutants > 0) {
    throw new Error(`${invalidMutants} mutants had an error, pending, ignored, or unknown status`)
  }

  const totalMutants = counts.Killed + counts.Timeout + counts.Survived + counts.NoCoverage
  if (totalMutants === 0) throw new Error('Mutation reports contain no valid mutants')

  const detectedMutants = counts.Killed + counts.Timeout
  const score = detectedMutants / totalMutants * PERCENT_SCALE
  console.info(
    `Mutation score ${score.toFixed(2)}% (floor ${MUTATION_SCORE_FLOOR}%; ` +
    `${detectedMutants}/${totalMutants} detected; ` +
    `killed ${counts.Killed}, timeout ${counts.Timeout}, survived ${counts.Survived}, ` +
    `no coverage ${counts.NoCoverage})`,
  )
  if (score < MUTATION_SCORE_FLOOR) {
    throw new Error(`Aggregate mutation score ${score.toFixed(2)}% is below ${MUTATION_SCORE_FLOOR}%`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
