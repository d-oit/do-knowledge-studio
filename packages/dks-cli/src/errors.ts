/** Machine-readable failure codes carried in every failed envelope. */
export type CliErrorCode =
  | 'usage'
  | 'validation'
  | 'not_found'
  | 'entity_not_found'
  | 'path_not_found'
  | 'conflict'
  | 'io'
  | 'permission'
  | 'internal'

/**
 * Failure with envelope metadata. Commands throw `CliError` for every
 * recoverable problem; the runner converts it into the JSON error envelope
 * and the mapped process exit code.
 */
export class CliError extends Error {
  readonly code: CliErrorCode
  readonly hint: string | undefined

  constructor(code: CliErrorCode, message: string, hint?: string) {
    super(message)
    this.name = 'CliError'
    this.code = code
    this.hint = hint
  }
}

/** Renders an unknown thrown value as a message without ever crashing. */
export const errorText = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)
