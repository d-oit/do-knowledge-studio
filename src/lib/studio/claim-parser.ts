/**
 * Pure, rule-based claim extraction (N4).
 *
 * Parses `Assertion: <statement> (Source: <source>)` blocks out of free-form
 * entity note text — no LLM, no side effects. The source group is the LAST
 * parenthesized group whose trimmed content starts with `source:`
 * (case-insensitive); the source itself is optional.
 */

/** A structured claim draft parsed from note text. */
export interface ParsedClaimDraft {
  statement: string
  source?: string
}

/** Marks the start of an assertion block. */
const ASSERTION_MARKER = /\bassertion\s*:\s*/gi

/** Prefix of a parenthesized source group. */
const SOURCE_PREFIX = /^source\s*:/i

/**
 * Resolves the close paren matching `openIndex`, tolerating nested groups and
 * scanning only up to `scanLimit`. Returns the index just past the close
 * paren, or -1 when the group is unbalanced before the limit.
 */
const findMatchingClose = (block: string, openIndex: number, scanLimit: number): number => {
  let depth = 1
  let cursor = openIndex + 1
  while (cursor < scanLimit && depth > 0) {
    const char = block[cursor]
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    cursor += 1
  }
  return depth === 0 ? cursor : -1
}

/**
 * Finds the last parenthesized group in `block` whose content starts with
 * `Source:`. Handles nested parens and returns the group's start index plus
 * the cleaned source value. Returns null when there is no source group.
 */
const findSourceGroup = (block: string): { start: number; value: string } | null => {
  let searchFrom = block.length - 1
  // Once a scan from a given `(` fails to close before the block end, every
  // later candidate's close paren — if it exists — lies strictly before that
  // failure point; scanning past it can never resolve. Bounding here keeps
  // unbalanced input linear instead of quadratic.
  let scanLimit = block.length
  while (searchFrom >= 0) {
    const openIndex = block.lastIndexOf('(', searchFrom)
    if (openIndex === -1) return null

    const closePast = findMatchingClose(block, openIndex, scanLimit)
    if (closePast === -1) {
      // Unbalanced group — treat its `(` as plain text, keep scanning left.
      scanLimit = openIndex
      searchFrom = openIndex - 1
      continue
    }

    const inner = block.slice(openIndex + 1, closePast - 1).trim()
    if (SOURCE_PREFIX.test(inner)) {
      return {
        start: openIndex,
        value: inner.replace(SOURCE_PREFIX, '').trim(),
      }
    }
    searchFrom = openIndex - 1
  }
  return null
}

/** Parses one assertion block into a statement, stripping its source group. */
const parseBlock = (block: string): { statement: string; source?: string } | null => {
  const sourceGroup = findSourceGroup(block)
  const statement = sourceGroup ? block.slice(0, sourceGroup.start).trim() : block.trim()
  if (!statement) return null
  const source = sourceGroup && sourceGroup.value.length > 0 ? sourceGroup.value : undefined
  return { statement, source }
}

/**
 * Extracts de-duplicated claim drafts from free-form note text. Malformed
 * blocks (e.g. a trailing `Assertion:` with no statement) are ignored.
 */
export const extractClaimsFromText = (text: string): ParsedClaimDraft[] => {
  const drafts: ParsedClaimDraft[] = []
  const seen = new Set<string>()
  const markers = Array.from(text.matchAll(ASSERTION_MARKER))

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]
    if (!marker) continue
    const blockStart = marker.index + marker[0].length
    const next = markers[index + 1]
    const blockEnd = next ? next.index : text.length
    const parsed = parseBlock(text.slice(blockStart, blockEnd))
    if (parsed === null) continue

    // JSON-encoded tuple key: no single-char delimiter is safe because both
    // statement and source are unrestricted strings (a NUL inside either
    // would otherwise collide distinct claims onto one key).
    const key = JSON.stringify([parsed.statement, parsed.source ?? ''])
    if (seen.has(key)) continue
    seen.add(key)
    drafts.push({ statement: parsed.statement, source: parsed.source })
  }
  return drafts
}

/** Cheap check for whether `text` contains at least one parseable assertion. */
export const hasExtractableClaims = (text: string): boolean =>
  extractClaimsFromText(text).length > 0