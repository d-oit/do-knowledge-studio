/**
 * Linear-time scanners for the Markdown link and machine-section grammars.
 *
 * These replace the equivalent global regexes that CodeQL flagged as
 * polynomial on uncontrolled input (issues #1163 review follow-ups): a greedy
 * `[^\]]*`-style class followed by a literal that may not match backtracks
 * one character per start position, which is quadratic on adversarial notes.
 * Each scanner below performs the same leftmost-first, non-overlapping scan
 * as the reference regex it replaces, in linear time, and is pinned to that
 * regex by a differential property test (`markdown-scan.test.ts`).
 */

/** A raw relative-link span: `[text](rawTarget)`, before target decoding. */
export interface RawLinkSpan {
  start: number
  end: number
  text: string
  rawTarget: string
}

/** A raw `[[Wikilink]]` span, optionally with the `|alias` display text. */
export interface RawWikiLinkSpan {
  start: number
  end: number
  name: string
  display?: string
}

/** One machine section (`# Claims` / `# Related`) located in a note body. */
export interface MachineSectionSpan {
  /** Match start: the heading's line feed when line-anchored, else the `#`. */
  start: number
  /** Match end (exclusive): the next `\n# ` heading or the end of input. */
  end: number
  /** The section body between the header line and the next heading. */
  content: string
}

/** Matches exactly one JavaScript `\s` character above the ASCII range. */
const UNICODE_SPACE = /^[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]$/

/** Mirrors the regex character class `\s` for one character. */
const isSpace = (c: string): boolean => c <= ' ' ? c !== '' : UNICODE_SPACE.test(c)

/** Mirrors the wikilink name class `[^\[\]|]` (no `[`, `]`, and `|`). */
const isNameChar = (c: string): boolean => c !== '[' && c !== ']' && c !== '|'

/** Mirrors the wikilink display class `[^\[\]]` (no `[` and `]`). */
const isDisplayChar = (c: string): boolean => c !== '[' && c !== ']'

/**
 * Scans `[text](target)` links exactly like
 * `/\[([^\]]*)\]\(([^)\s]+)\)/g`: leftmost matches, non-overlapping, text
 * ends at the first `]`, target is non-empty with no `)` and no whitespace,
 * and a failed candidate resumes the scan one character later.
 */
export const scanRelativeLinks = (body: string): RawLinkSpan[] => {
  const spans: RawLinkSpan[] = []
  const n = body.length
  let i = 0
  while (i < n) {
    const start = body.indexOf('[', i)
    if (start < 0) break
    const textEnd = body.indexOf(']', start + 1)
    // No `]` anywhere after this `[`: the regex cannot match at any later
    // start position either.
    if (textEnd < 0) break
    if (body.charCodeAt(textEnd + 1) === 40) {
      let k = textEnd + 2
      while (k < n) {
        const c: string = body[k] as string
        if (c === ')' || isSpace(c)) break
        k += 1
      }
      if (k < n && body[k] === ')' && k > textEnd + 2) {
        spans.push({
          start,
          end: k + 1,
          text: body.slice(start + 1, textEnd),
          rawTarget: body.slice(textEnd + 2, k),
        })
        i = k + 1
        continue
      }
    }
    i = start + 1
  }
  return spans
}

/**
 * Scans `[[Name]]` and `[[Name|Display]]` exactly like
 * `/\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g`: the name excludes `[`, `]` and
 * `|`, the optional display excludes `[` and `]`, and a candidate
 * whose display cannot close resumes one character later.
 */
export const scanWikilinks = (body: string): RawWikiLinkSpan[] => {
  const spans: RawWikiLinkSpan[] = []
  const n = body.length
  let i = 0
  while (i < n) {
    const start = body.indexOf('[[', i)
    if (start < 0) break
    let p = start + 2
    while (p < n && isNameChar(body.charAt(p))) p += 1
    const name = body.slice(start + 2, p)
    if (name.length === 0) {
      i = start + 1
      continue
    }
    if (body.charAt(p) === '|') {
      let q = p + 1
      while (q < n && isDisplayChar(body.charAt(q))) q += 1
      // An empty display cannot satisfy the optional group, and the `|`
      // cannot start `]]`: the whole candidate fails (regex backtrack).
      if (q > p + 1 && body.charAt(q) === ']' && body.charAt(q + 1) === ']') {
        spans.push({ start, end: q + 2, name, display: body.slice(p + 1, q) })
        i = q + 2
        continue
      }
      i = start + 1
      continue
    }
    if (body.charAt(p) === ']' && body.charAt(p + 1) === ']') {
      spans.push({ start, end: p + 2, name })
      i = p + 2
      continue
    }
    i = start + 1
  }
  return spans
}

/**
 * Locates one Markdown machine section, matching either
 * `# title\n[\s\S]*?(?:\n# |$)` (unanchored, per `parseRelatedIds`) or
 * `(?:^|\n)# title\n[\s\S]*?(?:\n# |$)` (line-anchored, per
 * `stripMachineSections`, which consumes the heading's preceding newline).
 */
export const findMachineSection = (
  body: string,
  title: string,
  lineAnchored: boolean,
): MachineSectionSpan | null => {
  const header = `# ${title}\n`
  let from = 0
  for (;;) {
    const h = body.indexOf(header, from)
    if (h < 0) return null
    if (lineAnchored && h > 0 && body.charCodeAt(h - 1) !== 10) {
      from = h + 1
      continue
    }
    const contentStart = h + header.length
    const next = body.indexOf('\n# ', contentStart)
    const contentEnd = next < 0 ? body.length : next
    return {
      start: lineAnchored && h > 0 ? h - 1 : h,
      end: contentEnd,
      content: body.slice(contentStart, contentEnd),
    }
  }
}
