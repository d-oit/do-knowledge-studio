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

/** Nesting contribution of a single character: +1 for '(', -1 for ')', else 0. */
const parenDelta = (char: string): number => {
  if (char === '(') return 1
  if (char === ')') return -1
  return 0
}

/** One `(` with its matching `)` position (-1 when unbalanced). */
interface MatchEntry {
  openIndex: number
  closeIndex: number
}

/**
 * Matches every `(` in `block` with its `)` in a single right-to-left stack
 * pass — each paren is visited exactly once, so balanced and unbalanced input
 * alike are handled in O(n) (no per-candidate rescans).
 */
const buildParenMatches = (block: string): MatchEntry[] => {
  const opens: number[] = []
  const matches: MatchEntry[] = []
  for (let i = block.length - 1; i >= 0; i -= 1) {
    const delta = parenDelta(block[i])
    if (delta === 0) continue
    if (delta < 0) {
      opens.push(i)
      continue
    }
    const closeIndex = opens.pop()
    matches.push({ openIndex: i, closeIndex: closeIndex ?? -1 })
  }
  return matches
}

/**
 * Finds the last parenthesized group in `block` whose content starts with
 * `Source:`. Handles nested parens and returns the group's start index plus
 * the cleaned source value. Returns null when there is no source group.
 */
const findSourceGroup = (block: string): { start: number; value: string } | null => {
  const matches = buildParenMatches(block)
  // The LAST parenthesized group wins: the source-group candidate with the
  // greatest openIndex, nesting aside (matches are pushed in close order, so
  // select by openIndex rather than iteration order).
  let best: MatchEntry | null = null
  for (const match of matches) {
    if (match.closeIndex === -1) continue
    if (best !== null && match.openIndex <= best.openIndex) continue
    const inner = block.slice(match.openIndex + 1, match.closeIndex).trim()
    if (SOURCE_PREFIX.test(inner)) best = match
  }
  if (best === null) return null
  const inner = block.slice(best.openIndex + 1, best.closeIndex).trim()
  return {
    start: best.openIndex,
    value: inner.replace(SOURCE_PREFIX, '').trim(),
  }
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

  const accept = (draft: ParsedClaimDraft | null): void => {
    if (draft === null) return
    // JSON-encoded tuple key: no single-char delimiter is safe because both
    // statement and source are unrestricted strings (a NUL inside either
    // would otherwise collide distinct claims onto one key).
    const key = JSON.stringify([draft.statement, draft.source ?? ''])
    if (seen.has(key)) return
    seen.add(key)
    drafts.push(draft)
  }

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]
    if (!marker) continue
    const blockStart = marker.index + marker[0].length
    const next = markers[index + 1]
    const blockEnd = next ? next.index : text.length
    accept(parseBlock(text.slice(blockStart, blockEnd)))
  }
  return drafts
}

/** Cheap check for whether `text` contains at least one parseable assertion. */
export const hasExtractableClaims = (text: string): boolean =>
  extractClaimsFromText(text).length > 0