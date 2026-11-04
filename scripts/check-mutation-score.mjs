import strykerConfig from '../stryker.config.json' with { type: 'json' }
import process from 'node:process'

const MUTATION_SCORE_FLOOR = 60
const PERCENT_SCALE = 100
const RECOGNIZED_STATUSES = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage'])

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const readReports = async () => {
  process.stdin.setEncoding('utf8')
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  if (input.trim().length === 0) throw new Error('No mutation report JSON provided on stdin')
  const parsed = JSON.parse(input)
  const reports = Array.isArray(parsed) ? parsed : [parsed]
  if (reports.length === 0) throw new Error('Mutation report input contains no reports')
  return reports
}

const main = async () => {
  if (process.argv.length > 2) {
    throw new Error('Usage: node scripts/check-mutation-score.mjs < mutation-report.json')
  }

  const config = strykerConfig
  if (!isRecord(config) || !Array.isArray(config.mutate) || config.mutate.some((file) => typeof file !== 'string')) {
    throw new Error('stryker.config.json must define a string-array mutate scope')
  }

  const expectedFiles = new Set(config.mutate)
  if (expectedFiles.size !== config.mutate.length || expectedFiles.size === 0) {
    throw new Error('stryker.config.json mutate scope must contain unique source files')
  }

  const reports = await readReports()
  const seenFiles = new Set()
  const counts = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0 }
  let invalidMutants = 0

  for (const [reportIndex, report] of reports.entries()) {
    const reportLabel = `mutation report ${reportIndex + 1}`
    if (!isRecord(report) || !isRecord(report.files)) {
      throw new Error(`Invalid Stryker report structure (${reportLabel})`)
    }

    for (const [file, fileReport] of Object.entries(report.files)) {
      if (!expectedFiles.has(file)) throw new Error(`Unexpected mutation scope entry '${file}' in ${reportLabel}`)
      if (seenFiles.has(file)) throw new Error(`Duplicate mutation report for '${file}'`)
      if (!isRecord(fileReport) || !Array.isArray(fileReport.mutants) || fileReport.mutants.length === 0) {
        throw new Error(`Mutation report for '${file}' has no mutant results`)
      }
      seenFiles.add(file)

      for (const mutant of fileReport.mutants) {
        if (!isRecord(mutant) || typeof mutant.status !== 'string') {
          throw new Error(`Malformed mutant result for '${file}' in ${reportLabel}`)
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
