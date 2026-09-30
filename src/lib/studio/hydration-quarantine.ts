/**
 * Quarantine for persistence envelopes the store refuses to hydrate.
 *
 * Why this exists (Plan 158 P0-3): the store used to throw out of the persist
 * `merge` callback to signal a rejected payload. That has two compounding
 * problems.
 *
 * 1. Zustand's hydrate chain sets `hasHydrated = true` in the `.then` AFTER
 *    `merge` runs, and a throw lands in the terminal `.catch` instead — so the
 *    store stays flagged "not yet hydrated" for the life of the page. The
 *    persist docs give `merge` no error semantics at all (their
 *    `## Troubleshooting` section is literally `TBD`), and expose
 *    `onRehydrateStorage` for reporting instead.
 * 2. The throw skipped only the `setItem` belonging to that hydration. The
 *    next `setState` still wrote seed state over the very envelope the code
 *    claimed to preserve, so a user's real corpus was destroyed on their
 *    first interaction with no error shown.
 *
 * The fix is to never throw, and to move the rejected bytes somewhere the
 * next write cannot touch — then tell the user it exists.
 */
import type { Claim, Entity } from './types'

/** localStorage key holding an envelope the store refused to hydrate. */
export const QUARANTINE_KEY = 'do-knowledge-studio-quarantine'

/**
 * Upper bound on the quarantined payload, mirroring the recovery snapshot.
 * Measured in UTF-8 BYTES, not `String.length` (which counts UTF-16 code
 * units and under-reports by up to 4x for astral characters — emoji in
 * entity names would silently blow past a cap declared in "bytes").
 */
const MAX_QUARANTINE_BYTES = 4 * 1024 * 1024

/** UTF-8 byte length of a string. */
const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length

/** Best-effort read of the envelope version, tolerating any malformed input. */
const readEnvelopeVersion = (raw: string): number | undefined => {
  try {
    const version = (JSON.parse(raw) as EnvelopePeek).version
    return typeof version === 'number' ? version : undefined
  } catch {
    return undefined
  }
}

/** A refused payload plus the reason it was refused. */
export interface QuarantineRecord {
  /** ISO timestamp of when the store rejected the payload. */
  rejectedAt: string
  /** Human-readable reason, safe to show in the UI. */
  reason: string
  /** The envelope version read from the rejected payload, when present. */
  version?: number
  /** The raw bytes exactly as they were on disk. */
  raw: string
}

/** Reads the quarantined record, or null when nothing is held. */
export const readQuarantine = (): QuarantineRecord | null => {
  let raw: string | null
  try {
    raw = localStorage.getItem(QUARANTINE_KEY)
  } catch (error) {
    console.error('Failed to read quarantined payload:', describe(error))
    return null
  }
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as QuarantineRecord).raw === 'string' &&
      typeof (parsed as QuarantineRecord).reason === 'string'
    ) {
      return parsed as QuarantineRecord
    }
  } catch {
    // A hand-mangled entry is unusable; drop it rather than wedge the check.
  }
  clearQuarantine()
  return null
}

/**
 * Moves a rejected envelope into quarantine. Returns false when storage
 * refused the write, so the caller can fall back to warning in the console
 * rather than pretending the data is safe.
 */
export const quarantinePayload = (reason: string, raw: string | null): boolean => {
  if (raw === null) {
    // Nothing to preserve (e.g. first run with no stored payload).
    return true
  }
  const size = utf8Bytes(raw)
  if (size > MAX_QUARANTINE_BYTES) {
    console.warn(
      `Rejected payload is ${size} bytes, over the ${MAX_QUARANTINE_BYTES}-byte quarantine limit; not preserved.`,
    )
    return false
  }
  // Never overwrite a payload we already preserved: a second rejection would
  // destroy the first user's only copy with no warning. Keep the earlier one
  // and note that a second was seen.
  const existing = readQuarantine()
  if (existing?.raw === raw) return true

  const record: QuarantineRecord = {
    rejectedAt: new Date().toISOString(),
    reason,
    // Recording the version turns "your data is wrong" into "your data is from
    // a newer build than this one understands", which is usually the real
    // cause and tells the user whether to retry elsewhere.
    version: readEnvelopeVersion(raw),
    raw,
  }
  if (existing) {
    console.warn(
      'A library payload was already preserved; keeping the earlier copy rather ' +
        'than replacing it.',
    )
  }
  try {
    localStorage.setItem(QUARANTINE_KEY, JSON.stringify(record))
    return true
  } catch (error) {
    console.error('Failed to quarantine rejected payload:', describe(error))
    return false
  }
}

/** Removes the quarantined payload. */
export const clearQuarantine = (): void => {
  try {
    localStorage.removeItem(QUARANTINE_KEY)
  } catch (error) {
    console.error('Failed to clear quarantined payload:', describe(error))
  }
}

/** Shape of a store envelope, read defensively. */
interface EnvelopePeek {
  version?: number
  state?: { entities?: Entity[]; claims?: Claim[] }
}

/** Best-effort count of records in a quarantined envelope, for the UI. */
export const describeQuarantine = (record: QuarantineRecord): string => {
  try {
    const parsed = JSON.parse(record.raw) as EnvelopePeek
    const entities = parsed?.state?.entities
    const claims = parsed?.state?.claims
    const parts: string[] = []
    if (Array.isArray(entities)) parts.push(`${entities.length} entities`)
    if (Array.isArray(claims)) parts.push(`${claims.length} claims`)
    return parts.length > 0 ? parts.join(' and ') : 'your previous library'
  } catch {
    return 'your previous library'
  }
}

/** Renders a caught value as a short string for logging. */
const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
