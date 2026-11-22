/**
 * Piped-stdin support for `-` path placeholders (e.g. `backup verify -`).
 * Implemented over the `process.stdin` stream — no `node:fs` involvement —
 * and reads nothing at all unless a command asks for it.
 */

import { decodeUtf8Strict } from './fs-port.js'

const toBytes = (chunk: string | Uint8Array): Uint8Array => {
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk)
  return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
}

/** Reads all of stdin as UTF-8 text; non-UTF-8 input is a failure. */
export const readStdinText = async (): Promise<string> => {
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of process.stdin) {
    const bytes = toBytes(chunk as string | Uint8Array)
    chunks.push(bytes)
    total += bytes.byteLength
  }
  const merged = new Uint8Array(total)
  let cursor = 0
  for (const bytes of chunks) {
    merged.set(bytes, cursor)
    cursor += bytes.byteLength
  }
  return decodeUtf8Strict(merged)
}
