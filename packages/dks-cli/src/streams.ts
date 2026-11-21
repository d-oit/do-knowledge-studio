/**
 * Process-stream guards for the `dks` entry point.
 *
 * `process.stdout.write` reports EPIPE asynchronously as a stream `error`
 * event, not as a thrown exception: `dks export | head -1` would otherwise
 * die with an uncaught stack trace and the reserved-for-nothing exit code 1.
 */

import { EXIT_INTERNAL, EXIT_OK } from './exit-codes.js'

/** Exit code for a stream error: pipelines succeed, real failures do not. */
export const exitCodeForStreamError = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === 'EPIPE'
    ? EXIT_OK
    : EXIT_INTERNAL

/** Minimal stream surface the guard needs (process.stdout or a test double). */
interface ErrorStream {
  on(event: 'error', listener: (err: unknown) => void): unknown
}

/** Installs the guard; injected `exit` keeps it testable without a process. */
export const installStreamGuard = (
  stream: ErrorStream,
  exit: (code: number) => void = (code) => process.exit(code),
): void => {
  stream.on('error', (err) => {
    exit(exitCodeForStreamError(err))
  })
}
