import { describe, expect, it } from 'vitest'
import { CHECK_BUNDLE_PARSED, CHECK_BUNDLE_PRESENT, CHECK_INTL_SEGMENTER, CHECK_OKF_VERSION, doctorReport, intlSegmenterAvailable } from './doctor.js'
import { nodeFsPort } from '../fs-port.js'
import { SEED_GRAPH_PERF_ID, seedBundle, seedBundleWithUnparsableConcept, withTempDir, writeBackupArchive } from '../fixtures.js'
import { CliError } from '../errors.js'

describe('doctorReport', () => {
  it('reports a healthy directory bundle with counts', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundle(dir)
      const report = doctorReport(nodeFsPort, bundlePath)
      expect(report.healthy).toBe(true)
      expect(report.bundle.kind).toBe('directory')
      expect(report.bundle.declaredOkfVersion).toBe('0.2')
      expect(report.counts.entities).toBe(3)
      expect(report.counts.claims).toBe(3)
      expect(report.counts.warnings).toBe(0)
      expect(report.checks.map((check) => check.id)).toEqual([
        CHECK_BUNDLE_PRESENT,
        CHECK_BUNDLE_PARSED,
        CHECK_OKF_VERSION,
        CHECK_INTL_SEGMENTER,
      ])
    })
  })

  it('surfaces non-bundle readable files as an io failure', async () => {
    await withTempDir(async (dir) => {
      const archive = await writeBackupArchive(dir, 'not-a-bundle.zip')
      try {
        doctorReport(nodeFsPort, archive.path)
        expect.unreachable('expected doctorReport to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('io')
        expect((err as CliError).message).toContain('not-a-bundle.zip')
      }
    })
  })

  it('throws not_found when the bundle path is missing', async () => {
    await withTempDir(async (dir) => {
      try {
        doctorReport(nodeFsPort, `${dir}/missing`)
        expect.unreachable('expected doctorReport to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('not_found')
      }
    })
  })

  it('throws io when the corpus is not a valid OKF bundle', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundle(dir, { skipIndex: true })
      try {
        doctorReport(nodeFsPort, bundlePath)
        expect.unreachable('expected doctorReport to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('io')
        expect((err as CliError).message).toContain('index.md')
      }
    })
  })

  it('throws io when okf_version is unknown to this build', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundle(dir, { version: '9.9' })
      try {
        doctorReport(nodeFsPort, bundlePath)
        expect.unreachable('expected doctorReport to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('io')
        expect((err as CliError).message).toContain('okf_version')
      }
    })
  })

  it('surfaces loader warnings and the segmenter check', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundleWithUnparsableConcept(dir)
      const report = doctorReport(nodeFsPort, bundlePath)
      expect(report.counts.warnings).toBe(1)
      expect(report.warnings.at(0)).toContain('raw.md')
      expect(report.engine.intlSegmenter).toBe(intlSegmenterAvailable())
    })
  })
})

describe('intlSegmenterAvailable', () => {
  it('matches the current engine capability', () => {
    expect(intlSegmenterAvailable()).toBe(typeof Intl.Segmenter === 'function')
  })
})

describe('doctor concept integrity', () => {
  it('keeps concept ids stable against load order', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundle(dir)
      const report = doctorReport(nodeFsPort, bundlePath)
      const search = report.checks.find((check) => check.id === CHECK_BUNDLE_PARSED)
      expect(search?.detail).toBe('3 concept(s)')
      expect(report.warnings).toEqual([])
      expect(report.checks.every((check) => check.ok)).toBe(true)
    })
  })
})

describe('doctor fixture sanity', () => {
  it('seed bundle exposes the graph-perf concept through doctor counts', async () => {
    await withTempDir(async (dir) => {
      const bundlePath = await seedBundle(dir)
      const entityCount = doctorReport(nodeFsPort, bundlePath).counts.entities
      const bundle = (await import('../bundle.js')).loadBundle(nodeFsPort, bundlePath)
      expect(bundle.concepts.some((concept) => concept.id === SEED_GRAPH_PERF_ID)).toBe(true)
      expect(entityCount).toBe(bundle.concepts.length)
    })
  })
})
