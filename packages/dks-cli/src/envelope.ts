/**
 * The #1171 result envelope.
 *
 * Success:   { ok: true,  data, meta: { command, version } }
 * Failure:   { ok: false, error: { code, message, hint? }, meta }
 * The failure envelope is printed to stdout in `--format json` mode and
 * rendered as stderr diagnostics in human mode; both carry the same shape.
 */

import type { CliErrorCode } from './errors.js'
import { EXIT_CONFLICT, EXIT_INTERNAL, EXIT_IO, EXIT_NOT_FOUND, EXIT_PERMISSION, EXIT_USAGE } from './exit-codes.js'
import { CLI_VERSION } from './version.js'

/** Common envelope footer: which command ran and with which CLI build. */
export interface EnvelopeMeta {
  command: string
  version: string
}

/** Structured error payload of a failed envelope. */
export interface EnvelopeError {
  code: CliErrorCode
  message: string
  hint?: string
}

/** Ok envelope with the command's JSON data payload. */
export interface OkEnvelope<T> {
  ok: true
  data: T
  meta: EnvelopeMeta
}

/** Failure envelope; identical shape regardless of command. */
export interface FailureEnvelope {
  ok: false
  error: EnvelopeError
  meta: EnvelopeMeta
}

export type Envelope<T> = OkEnvelope<T> | FailureEnvelope

/** Maps an error code onto the #1171 process exit code. */
export const exitCodeFor = (code: CliErrorCode): number => {
  switch (code) {
    case 'usage':
    case 'validation':
      return EXIT_USAGE
    case 'not_found':
    case 'entity_not_found':
    case 'path_not_found':
      return EXIT_NOT_FOUND
    case 'conflict':
      return EXIT_CONFLICT
    case 'io':
      return EXIT_IO
    case 'permission':
      return EXIT_PERMISSION
    case 'internal':
      return EXIT_INTERNAL
  }
}

const makeMeta = (command: string): EnvelopeMeta => ({ command, version: CLI_VERSION })

/** Builds the success envelope for a command's data payload. */
export const okEnvelope = <T>(command: string, data: T): OkEnvelope<T> => ({
  ok: true,
  data,
  meta: makeMeta(command),
})

/** Builds the failure envelope; `hint` is omitted when absent. */
export const failureEnvelope = (
  command: string,
  code: CliErrorCode,
  message: string,
  hint?: string,
): FailureEnvelope => {
  const error: EnvelopeError = { code, message }
  if (hint !== undefined) error.hint = hint
  return { ok: false, error, meta: makeMeta(command) }
}
