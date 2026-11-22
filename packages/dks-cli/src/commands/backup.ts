/**
 * `dks backup verify` — integrity verification of a `.dksb` archive via
 * dks-core. Security posture (#1171): passphrases are never accepted as
 * argv — only `--passphrase-env VARNAME` (environment) or empty. The
 * archive itself may be a path or `-` (stdin).
 */

import {
  verifyBackupArchive,
  type BackupErrorCode,
  type BackupVerifyResult,
  type FsPort,
  type VerifiedBackupSummary,
} from 'dks-core'
import { CliError, errorText } from '../errors.js'
import { decodeUtf8Strict, fsErrorCode, validateBundlePath } from '../fs-port.js'

/** The only passphrase channel: an environment variable name. */
export const PASSPHRASE_FLAG = '--passphrase-env'
/** stdin placeholder for the archive path. */
export const STDIN_PATH = '-'

export interface BackupSummaryData {
  formatVersion: number
  schemaVersion: number
  appVersion: string
  exportedAt: string
  encrypted: boolean
  entityCount: number
  claimCount: number
  graphEdgeCount: number
  mindMapEdgeCount: number
  linkCount: number
  tagCount: number
  graphViewCount: number
}

export interface BackupVerifyData {
  archive: string
  verified: boolean
  summary: BackupSummaryData
}

/** Maps a core backup failure onto CLI failure codes. */
const exitCodeForBackupFailure = (code: BackupErrorCode): 'conflict' | 'permission' | 'io' => {
  if (code === 'passphrase-required' || code === 'decrypt-failed') return 'permission'
  if (code === 'checksum') return 'conflict'
  return 'io'
}

interface ParsedArguments {
  archivePath: string
  passphrase: string | undefined
}

const parseBackupArgs = (
  args: readonly string[],
  env: ReadonlyMap<string, string>,
): ParsedArguments => {
  let archivePath: string | undefined
  let passphraseEnvName: string | undefined
  for (let index = 0; index < args.length; index += 1) {
    const token = args.at(index)
    if (typeof token !== 'string') break
    switch (token) {
      case PASSPHRASE_FLAG: {
        const name = args.at(index + 1)
        if (name === undefined || name.startsWith('--')) {
          throw new CliError('usage', `${PASSPHRASE_FLAG} needs a variable name`, 'dks backup verify ARCHIVE --passphrase-env VARNAME')
        }
        passphraseEnvName = name
        index += 1
        continue
      }
      default:
        break
    }
    if (token.startsWith('--passphrase')) {
      // Never interpolate the offending token: `--passphrase=hunter2` would
      // echo the secret into diagnostics (and CI logs).
      throw new CliError(
        'usage',
        'passphrases are never accepted on the command line',
        `use ${PASSPHRASE_FLAG} VARNAME and put the secret in the environment`,
      )
    }
    if (archivePath !== undefined) {
      // Never interpolate the surplus token: a user may put the passphrase in
      // the wrong argument position, and diagnostics must not echo it.
      throw new CliError(
        'usage',
        'backup verify accepts one archive path; extra arguments are not allowed',
        'dks backup verify ARCHIVE [--passphrase-env VARNAME]',
      )
    }
    archivePath = token
    validateBundlePath(token)
  }

  if (archivePath === undefined) {
    throw new CliError('usage', 'backup verify needs an archive path', 'dks backup verify ARCHIVE [--passphrase-env VARNAME]')
  }

  let passphrase: string | undefined
  if (passphraseEnvName !== undefined) {
    const value = env.get(passphraseEnvName)
    if (value === undefined || value.length === 0) {
      // Never echo the variable name: a user who mistakes the flag's value
      // for the passphrase would leak it into diagnostics and JSON output.
      throw new CliError(
        'usage',
        'the passphrase environment variable is not set',
        `set the variable named by ${PASSPHRASE_FLAG} before running dks backup verify`,
      )
    }
    passphrase = value
  }
  return { archivePath, passphrase }
}

const readArchiveText = async (port: FsPort, archivePath: string): Promise<string> => {
  let bytes: Uint8Array
  try {
    bytes = await port.readFileBytes(archivePath)
  } catch (err) {
    throw new CliError(fsErrorCode(err), `archive "${archivePath}" could not be read: ${errorText(err)}`)
  }
  return decodeUtf8Strict(bytes)
}

const summaryOf = (summary: VerifiedBackupSummary): BackupSummaryData => ({
  formatVersion: summary.formatVersion,
  schemaVersion: summary.schemaVersion,
  appVersion: summary.appVersion,
  exportedAt: summary.exportedAt,
  encrypted: summary.encrypted,
  entityCount: summary.entityCount,
  claimCount: summary.claimCount,
  graphEdgeCount: summary.graphEdgeCount,
  mindMapEdgeCount: summary.mindMapEdgeCount,
  linkCount: summary.linkCount,
  tagCount: summary.tagCount,
  graphViewCount: summary.graphViewCount,
})

/**
 * Verifies an archive; verification failures (tamper, checksums, missing
 * passphrase) surface as error envelopes with mapped exit codes.
 */
export const backupVerifyData = async (
  args: readonly string[],
  deps: {
    port: FsPort
    env: ReadonlyMap<string, string>
    stdin: () => Promise<string>
  },
): Promise<BackupVerifyData> => {
  const { archivePath, passphrase } = parseBackupArgs(args, deps.env)

  let raw: string
  if (archivePath === STDIN_PATH) {
    try {
      raw = await deps.stdin()
    } catch (err) {
      throw new CliError('io', `stdin could not be read: ${errorText(err)}`)
    }
  } else {
    raw = await readArchiveText(deps.port, archivePath)
  }

  const result: BackupVerifyResult =
    passphrase === undefined ? await verifyBackupArchive(raw) : await verifyBackupArchive(raw, passphrase)

  if (result.ok) {
    return { archive: archivePath, verified: true, summary: summaryOf(result) }
  }
  const firstError = result.errors.at(0) ?? 'verification failed'
  const hint = result.errors.slice(1).join('; ')
  throw new CliError(
    exitCodeForBackupFailure(result.code),
    `backup verification failed (${result.code}): ${firstError}`,
    hint.length > 0 ? hint : undefined,
  )
}
