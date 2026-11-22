#!/usr/bin/env node
/**
 * Process entry point for `dks`. Kept separate from `cli.ts` so importing the
 * runner in tests never starts a CLI or installs process-level handlers.
 */

import { runCli } from './cli.js'
import { EXIT_INTERNAL } from './exit-codes.js'
import { readStdinText } from './stdin.js'
import { exitCodeForStreamError, installStreamGuard } from './streams.js'

/** Writes one line unless the stream is gone; EPIPE stays pipeline-friendly. */
const writeLine = (stream: NodeJS.WriteStream, text: string): void => {
  if (text.length === 0) return
  try {
    stream.write(`${text}\n`)
  } catch (err) {
    // Synchronous EPIPE: exit success, like the async guard.
    process.exit(exitCodeForStreamError(err))
  }
}

const main = (): void => {
  installStreamGuard(process.stdout)
  installStreamGuard(process.stderr)
  const env = new Map(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined))
  void runCli(process.argv.slice(2), { env, stdin: readStdinText })
    .then((result) => {
      writeLine(process.stdout, result.stdout)
      writeLine(process.stderr, result.stderr)
      process.exitCode = result.exitCode
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      writeLine(process.stderr, `dks: internal error: ${message}`)
      process.exitCode = EXIT_INTERNAL
    })
}

main()
