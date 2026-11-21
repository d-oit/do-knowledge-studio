/** `dks version` — identity of the running CLI build. */

import { CLI_NAME, CLI_VERSION } from '../version.js'

export interface VersionData {
  version: string
  name: typeof CLI_NAME
  node: string
}

export const versionData = (): VersionData => ({
  version: CLI_VERSION,
  name: CLI_NAME,
  node: process.version,
})
