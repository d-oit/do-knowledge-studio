#!/usr/bin/env node
/**
 * `dks-mcp` CLI. Today the only command is `serve`: load an exported OKF
 * bundle (zip or directory) and expose it read-only over MCP stdio.
 * Fail-closed: an unreadable or invalid bundle exits non-zero with the
 * reason on stderr and never serves partial state.
 */

import { loadBundle } from './bundle-reader.js'
import { LibraryIndex } from './library-index.js'
import { createServer, serveStdio } from './server.js'

/** CLI usage text (placeholders are not HTML, so no angle brackets). */
const USAGE_TEXT = 'Usage: dks-mcp serve BUNDLE (a .zip export or a directory of .md files)'

/** Runs the CLI; returns the process exit code. */
const main = async (): Promise<number> => {
  const [command, target] = process.argv.slice(2)
  if (command !== 'serve' || !target) {
    console.error(USAGE_TEXT)
    return 2
  }
  let loaded
  try {
    loaded = loadBundle(target)
  } catch (err) {
    console.error(`dks-mcp: ${err instanceof Error ? err.message : 'failed to load bundle'}`)
    return 1
  }
  for (const warning of loaded.warnings) {
    console.error(`dks-mcp warning: ${warning}`)
  }
  const index = new LibraryIndex(loaded.concepts)
  console.error(`dks-mcp: serving ${index.size} concepts over stdio (read-only).`)
  await serveStdio(createServer(index))
  return 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((err: unknown) => {
    console.error(`dks-mcp: ${err instanceof Error ? err.message : 'fatal error'}`)
    process.exitCode = 1
  })
