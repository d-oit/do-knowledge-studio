#!/usr/bin/env node
/**
 * `dks` — read-only operator CLI over an OKF knowledge bundle (#1171).
 *
 * Contract: every command prints one result envelope —
 *   success: { ok: true, data, meta: { command, version } }
 *   failure: { ok: false, error: { code, message, hint? }, meta }
 * Human mode prints formatted text instead (data) or stderr diagnostics
 * (failures); `--format json` always prints the envelope to stdout.
 *
 * Exit codes: 0 ok · 2 usage/validation · 3 not-found · 4 conflict ·
 * 5 io · 6 permission · 7 internal.
 *
 * All filesystem access flows through the reviewed `FsPort` in fs-port.ts
 * (single entry point for computed-path reads, LESSON-063).
 */

import { parseInvocation, globalFlagsHint, type Invocation } from './args.js'
import { loadBundle, resolveBundlePath } from './bundle.js'
import { backupVerifyData } from './commands/backup.js'
import { doctorReport } from './commands/doctor.js'
import { COMMAND_DOCS, helpData } from './commands/help.js'
import {
  aliasesData,
  claimsData,
  entityData,
  indexData,
  relationsData,
  searchData,
} from './commands/queries.js'
import { graphData } from './commands/graph.js'
import { skillsData } from './commands/skills.js'
import { exportData } from './commands/export-cmd.js'
import { versionData } from './commands/version.js'
import { exitCodeFor, failureEnvelope, okEnvelope } from './envelope.js'
import { CliError, errorText } from './errors.js'
import { nodeFsPort } from './fs-port.js'
import { renderErrorText, renderPayloadText, type CommandPayload } from './render.js'
import { readStdinText } from './stdin.js'
import { EXIT_INTERNAL, EXIT_OK } from './exit-codes.js'
import { DEFAULT_LIMIT } from './args.js'

const COMMAND_NAMES: readonly string[] = COMMAND_DOCS.map((doc) => doc.name)

const HELP_COMMAND = 'help'
const NO_COMMAND = '(none)'

/** Suggestion distance for "did you mean" hints on unknown commands. */
const SUGGESTION_MAX_DISTANCE = 2

/** Levenshtein distance over code points (small inputs only). */
const editDistance = (a: string, b: string): number => {
  const row: number[] = Array.from({ length: b.length + 1 }, (_unused, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j] ?? 0
      const left = row[j - 1] ?? 0
      const diagonal = previous
      const substitutionCost = (a.charAt(i - 1) === b.charAt(j - 1)) ? 0 : 1
      previous = row[j] ?? 0
      row[j] = Math.min(diagonal + substitutionCost, above + 1, left + 1)
    }
  }
  return row[b.length] ?? 0
}

/** Nearest known command within the suggestion distance, if any. */
const nearestCommand = (input: string): string | undefined => {
  let best: string | undefined
  let bestDistance = SUGGESTION_MAX_DISTANCE + 1
  for (const name of COMMAND_NAMES) {
    const distance = editDistance(input, name)
    if (distance < bestDistance) {
      best = name
      bestDistance = distance
    }
  }
  return bestDistance <= SUGGESTION_MAX_DISTANCE ? best : undefined
}

/** Usage failure for an unrecognized command, with a nearest hint. */
const unknownCommandError = (input: string): CliError => {
  const nearest = nearestCommand(input)
  const hint = nearest === undefined
    ? 'run "dks help" for the command list'
    : `run "dks help" for the command list — closest known command: "${nearest}"`
  return new CliError('usage', `unknown command "${input}"`, hint)
}

export interface RunIo {
  /** Environment variables (Map-backed) for bundle + passphrase lookup. */
  env: ReadonlyMap<string, string>
  /** stdin reader for `-` placeholders. */
  stdin: () => Promise<string>
}

export interface CliResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** Commands take no local flags besides their own; rejects leftovers. */
const rejectUnknownFlags = (args: readonly string[], command: string): void => {
  if (args.some((token) => token.startsWith('-') && token.length > 1)) {
    const offender = args.find((token) => token.startsWith('-')) ?? ''
    throw new CliError('usage', `unknown option "${offender}" for ${command}`, globalFlagsHint())
  }
}

const requireSingleArg = (args: readonly string[], usage: string): string => {
  if (args.length !== 1) throw new CliError('usage', usage)
  const value = args.at(0) ?? ''
  return value
}

/** Dispatches a parsed invocation to its command implementation. */
const dispatch = async (invocation: Invocation, io: RunIo): Promise<CommandPayload> => {
  const { command, args, flags } = invocation
  const bundlePath = resolveBundlePath(flags.bundle, io.env)
  const load = (): ReturnType<typeof loadBundle> => loadBundle(nodeFsPort, bundlePath)
  const limit = flags.limit ?? DEFAULT_LIMIT

  switch (command) {
    case '':
    case HELP_COMMAND: {
      const target = args.at(0)
      if (target !== undefined && !COMMAND_NAMES.includes(target)) {
        throw unknownCommandError(target)
      }
      return helpData()
    }
    case 'version': {
      rejectUnknownFlags(args, command)
      return versionData()
    }
    case 'doctor': {
      rejectUnknownFlags(args, command)
      return doctorReport(nodeFsPort, resolveBundlePath(flags.bundle, io.env))
    }
    case 'search': {
      rejectUnknownFlags(args, command)
      const query = args.join(' ').trim()
      if (query.length === 0) {
        throw new CliError('usage', 'search needs a query', 'dks search <query...> — words are stemmed and prefix-matched')
      }
      return searchData(load(), query, limit)
    }
    case 'entity': {
      const id = requireSingleArg(args, 'dks entity <id>')
      return entityData(load(), id)
    }
    case 'claims': {
      const id = requireSingleArg(args, 'dks claims <entityId>')
      return claimsData(load(), id)
    }
    case 'aliases': {
      const id = requireSingleArg(args, 'dks aliases <id>')
      return aliasesData(load(), id)
    }
    case 'relations': {
      const id = requireSingleArg(args, 'dks relations <id>')
      return relationsData(load(), id)
    }
    case 'index': {
      rejectUnknownFlags(args, command)
      return indexData(load(), limit)
    }
    case 'graph':
      return graphData(args, load)
    case 'backup': {
      const sub = args.at(0)
      if (sub !== 'verify') {
        const message = sub === undefined ? 'backup needs a subcommand' : `unknown backup subcommand "${sub}"`
        throw new CliError('usage', message, 'known subcommands: verify')
      }
      return backupVerifyData(args.slice(1), { port: nodeFsPort, env: io.env, stdin: io.stdin })
    }
    case 'skills':
      return skillsData(args, nodeFsPort, resolveBundlePath(flags.bundle, io.env))
    case 'export': {
      rejectUnknownFlags(args, command)
      if (args.length > 0) throw new CliError('usage', 'export takes no arguments', 'dks export [--format md|json]')
      return exportData(load(), flags.format)
    }
    default:
      throw unknownCommandError(command)
  }
}

/**
 * Runs one CLI invocation end to end and returns everything to print plus
 * the process exit code — no I/O of its own, so tests can assert exactly.
 */
export const runCli = async (argv: readonly string[], io: RunIo): Promise<CliResult> => {
  const out: string[] = []
  const errLines: string[] = []
  let invocation: Invocation = { command: '', args: [], flags: { format: 'text', quiet: false, noColor: false, limit: undefined, bundle: undefined } }
  try {
    invocation = parseInvocation(argv)
    const data = await dispatch(invocation, io)
    const command = invocation.command === '' ? HELP_COMMAND : invocation.command
    if (invocation.flags.format === 'json') {
      out.push(JSON.stringify(okEnvelope(command, data)))
    } else if (!invocation.flags.quiet) {
      out.push(renderPayloadText(command, data))
    }
  } catch (err) {
    const label = invocation.command === '' ? NO_COMMAND : invocation.command
    if (err instanceof CliError) {
      if (invocation.flags.format === 'json') {
        out.push(JSON.stringify(failureEnvelope(label, err.code, err.message, err.hint)))
      } else {
        errLines.push(renderErrorText(label, err.message, err.hint))
      }
      return { exitCode: exitCodeFor(err.code), stdout: out.join('\n'), stderr: errLines.join('\n') }
    }
    const message = `internal error: ${errorText(err)}`
    if (invocation.flags.format === 'json') {
      out.push(JSON.stringify(failureEnvelope(label, 'internal', message)))
    } else {
      errLines.push(message)
    }
    return { exitCode: EXIT_INTERNAL, stdout: out.join('\n'), stderr: errLines.join('\n') }
  }
  return { exitCode: EXIT_OK, stdout: out.join('\n'), stderr: errLines.join('\n') }
}

const writeOut = (text: string): void => {
  try {
    process.stdout.write(`${text}\n`)
  } catch {
    // Downstream pipe closed (e.g. `| head`): exit quietly, pipes friendly.
    process.exitCode = EXIT_OK
  }
}

/** Real process entry point. */
const main = (): void => {
  const env = new Map(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined))
  void runCli(process.argv.slice(2), { env, stdin: readStdinText }).then((result) => {
    if (result.stdout.length > 0) writeOut(result.stdout)
    if (result.stderr.length > 0) {
      try {
        process.stderr.write(`${result.stderr}\n`)
      } catch {
        // stderr unavailable: nothing sensible left to do.
      }
    }
    process.exitCode = result.exitCode
  })
}

main()
