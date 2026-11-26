/**
 * #1171 argument surface: global flags may appear before or after the
 * subcommand; the first operand is the command; unknown `--` flags pass
 * through to the command layer, which owns its local flags and rejects
 * anything unexpected. Single-dash short options are refused (stdin's bare
 * `-` placeholder is an operand, not a flag).
 */

import { CliError } from './errors.js'

export type OutputFormat = 'text' | 'json'

export const FORMAT_JSON = 'json'
export const FORMAT_TEXT = 'text'
export const DEFAULT_LIMIT = 20
export const MIN_LIMIT = 1
export const MAX_RANGE_LIMIT = 200

/** Global flag token list; value-taking flags expect the next argument. */
export const GLOBAL_FLAG_NAMES = [
  '--format JSON|TEXT',
  '--quiet',
  '--verbose',
  '--no-color',
  '--limit N',
  '--bundle PATH',
] as const

export interface GlobalFlags {
  format: OutputFormat
  quiet: boolean
  verbose: boolean
  noColor: boolean
  limit: number | undefined
  bundle: string | undefined
}

export interface Invocation {
  command: string
  args: string[]
  flags: GlobalFlags
}

const VALUE_FLAGS = new Set(['--format', '--limit', '--bundle'])
const BOOLEAN_FLAGS = new Set(['--quiet', '--verbose', '--no-color'])

/** Hint shown for an unusable `--limit`, derived from the bounds above. */
const limitHint = (): string =>
  `default ${DEFAULT_LIMIT} · allowed range ${MIN_LIMIT}–${MAX_RANGE_LIMIT}`

/** Parses `--limit`; non-integers are usage errors, ranges clamp. */
export const parseLimit = (raw: string): number => {
  const value = Number(raw)
  if (!Number.isInteger(value)) {
    throw new CliError('usage', `--limit expects an integer, got "${raw}"`, limitHint())
  }
  if (value < MIN_LIMIT) return MIN_LIMIT
  if (value > MAX_RANGE_LIMIT) return MAX_RANGE_LIMIT
  return value
}

/** Hint listing the global flags for any unrecognized option. */
export const globalFlagsHint = (): string => `known global flags: ${GLOBAL_FLAG_NAMES.join(' · ')}`

/**
 * Parses an argv slice into command + operands + global flags. Unknown
 * `--` tokens are passed through in `args`; each command validates them.
 */
export const parseInvocation = (argv: readonly string[]): Invocation => {
  const flags: GlobalFlags = {
    format: FORMAT_TEXT,
    quiet: false,
    verbose: false,
    noColor: false,
    limit: undefined,
    bundle: undefined,
  }
  const args: string[] = []
  let command = ''
  let commandSeen = false
  let helpRequested = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv.at(index)
    if (typeof token !== 'string') break
    switch (token) {
      case '--help':
      case '-h':
        command = 'help'
        commandSeen = true
        helpRequested = true
        // `dks search foo --help` asks for search help, not help for "foo".
        args.length = 0
        continue
      default:
        break
    }
    if (token.startsWith('--')) {
      if (VALUE_FLAGS.has(token)) {
        const value = argv.at(index + 1)
        if (value === undefined) {
          throw new CliError('usage', `flag "${token}" is missing its value`, globalFlagsHint())
        }
        index += 1
        switch (token) {
          case '--format':
            switch (value) {
              case FORMAT_JSON:
              case FORMAT_TEXT:
                flags.format = value
                break
              default:
                throw new CliError('usage', `--format expects "json" or "text", got "${value}"`, globalFlagsHint())
            }
            break
          case '--limit':
            flags.limit = parseLimit(value)
            break
          default:
            flags.bundle = value
        }
      } else if (BOOLEAN_FLAGS.has(token)) {
        switch (token) {
          case '--quiet':
            flags.quiet = true
            break
          case '--verbose':
            flags.verbose = true
            break
          default:
            flags.noColor = true
        }
      } else {
        // Not a global flag: hand it to the command, which knows its own
        // local flags and rejects everything else (unknown → usage).
        if (!helpRequested) args.push(token)
      }
      continue
    }
    if (token.startsWith('-') && token.length > 1) {
      throw new CliError('usage', `unknown option "${token}"`, globalFlagsHint())
    }
    if (!commandSeen) {
      command = token
      commandSeen = true
    } else if (!helpRequested) {
      args.push(token)
    }
  }

  return { command, args, flags }
}

/**
 * Splits command-local args into operands and `--flag value` pairs.
 * Anything looking like an unknown flag is a usage error naming the
 * allowed local flags.
 */
export const parseLocalFlags = (
  args: readonly string[],
  allowed: readonly string[],
): { options: Map<string, string>; operands: string[] } => {
  const options = new Map<string, string>()
  const operands: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const token = args.at(index)
    if (typeof token !== 'string') break
    if (token.startsWith('--')) {
      if (!allowed.includes(token)) {
        throw new CliError('usage', `unknown option "${token}"`, `known options: ${allowed.join(', ')}`)
      }
      const value = args.at(index + 1)
      if (value === undefined) {
        throw new CliError('usage', `flag "${token}" is missing its value`, `known options: ${allowed.join(', ')}`)
      }
      options.set(token, value)
      index += 1
      continue
    }
    if (token.startsWith('-') && token.length > 1) {
      throw new CliError('usage', `unknown option "${token}"`, `known options: ${allowed.join(', ')}`)
    }
    operands.push(token)
  }
  return { options, operands }
}
