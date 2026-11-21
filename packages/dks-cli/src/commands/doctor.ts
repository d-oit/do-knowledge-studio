/**
 * `dks doctor` — corpus presence + integrity report: bundle resolution,
 * parse result, declared/supported `okf_version`, entity/claim counts,
 * loader warnings, and engine health notes (Intl.Segmenter).
 */

import { SUPPORTED_OKF_MAJOR, type FsPort } from 'dks-core'
import { BUNDLE_HINT, bundleClaims, loadBundle, readRootIndexVersion } from '../bundle.js'
import { CliError } from '../errors.js'

export const KIND_DIRECTORY = 'directory'
export const KIND_ZIP = 'zip'

export const CHECK_BUNDLE_PRESENT = 'bundle-present'
export const CHECK_BUNDLE_PARSED = 'bundle-parsed'
export const CHECK_OKF_VERSION = 'okf-version'
export const CHECK_INTL_SEGMENTER = 'engine-intl-segmenter'

export interface DoctorCheck {
  id: string
  ok: boolean
  detail: string
}

export interface DoctorData {
  bundle: {
    path: string
    kind: typeof KIND_DIRECTORY | typeof KIND_ZIP
    declaredOkfVersion: string | null
    supportedOkfVersion: string
  }
  counts: { entities: number; claims: number; warnings: number }
  checks: DoctorCheck[]
  warnings: string[]
  engine: { node: string; intlSegmenter: boolean }
  healthy: boolean
}

/** Engine health probe: Intl.Segmenter power dks-core tokenization. */
export const intlSegmenterAvailable = (): boolean =>
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'

/** Reports corpus presence + integrity for the bundle at `bundlePath`. */
export const doctorReport = (port: FsPort, bundlePath: string): DoctorData => {
  const isDir = port.isDirectory(bundlePath)
  if (!isDir) {
    // Not a directory: it may be a zip archive (readable file) or missing.
    try {
      port.readFileBytes(bundlePath)
    } catch {
      throw new CliError('not_found', `bundle not found at "${bundlePath}"`, BUNDLE_HINT)
    }
  }
  const bundle = loadBundle(port, bundlePath)
  const claims = bundleClaims(bundle)
  const kind = isDir ? KIND_DIRECTORY : KIND_ZIP
  const declaredOkfVersion = isDir ? readRootIndexVersion(port, bundlePath) : null
  const segmenter = intlSegmenterAvailable()

  const checks: DoctorCheck[] = [
    { id: CHECK_BUNDLE_PRESENT, ok: true, detail: `${kind} at ${bundlePath}` },
    { id: CHECK_BUNDLE_PARSED, ok: true, detail: `${bundle.concepts.length} concept(s)` },
    {
      id: CHECK_OKF_VERSION,
      ok: true,
      detail:
        declaredOkfVersion === null
          ? `supported major ${SUPPORTED_OKF_MAJOR} (enforced by the loader)`
          : `declared ${declaredOkfVersion} (supported major ${SUPPORTED_OKF_MAJOR}, enforced by the loader)`,
    },
    {
      id: CHECK_INTL_SEGMENTER,
      ok: segmenter,
      detail: segmenter
        ? 'available; search tokenizes via Intl.Segmenter'
        : 'unavailable; search tokenization falls back to ASCII',
    },
  ]

  return {
    bundle: { path: bundlePath, kind, declaredOkfVersion, supportedOkfVersion: SUPPORTED_OKF_MAJOR },
    counts: {
      entities: bundle.concepts.length,
      claims: claims.length,
      warnings: bundle.warnings.length,
    },
    checks,
    warnings: [...bundle.warnings],
    engine: { node: process.version, intlSegmenter: segmenter },
    healthy: checks.every((check) => check.ok),
  }
}
