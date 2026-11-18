/**
 * Minimal YAML-subset frontmatter parser.
 *
 * Core services are dependency-free and run in Node with no third-party
 * packages, so this parser covers the YAML subset actually used by OKF
 * concept frontmatter and Markdown vault notes:
 *   - `key: scalar` (string, number, boolean, null)
 *   - single/double quoted strings with common escapes
 *   - inline flow arrays `[a, b]`
 *   - block lists `- item` / `- key: value` / nested maps
 *   - full-line comments and trailing comments after values
 *   - nested maps by indentation (sources, verified, generated)
 * Anything outside this subset either yields a parse error (fail-closed) or
 * is preserved as a raw string. The studio app uses the full `yaml`
 * package; this subset is tested against the same fixtures and is documented
 * as a deliberate, bounded implementation.
 */

/** A parsed value node: plain JSON values plus nested maps/arrays. */
export type FmValue = string | number | boolean | null | FmValue[] | { [key: string]: FmValue }

/** Result of parsing a frontmatter block. */
export type FmResult = { ok: true; data: Record<string, FmValue> } | { ok: false; error: string }

/** Strips a trailing comment (` # ...`) from a value; URLs keep their `#`. */
const stripTrailingComment = (raw: string): string => {
  const idx = raw.indexOf(' #')
  return idx !== -1 ? raw.slice(0, idx).trimEnd() : raw.trimEnd()
}

/** Splits a line into indent and content; tabs are refused (fail-closed). */
const indentOf = (line: string): { indent: number; content: string } => {
  let indent = 0
  for (const ch of line) {
    if (ch === ' ') indent += 1
    else if (ch === '\t') return { indent: -1, content: line.trimStart() }
    else break
  }
  return { indent, content: line.slice(indent) }
}

/** Unquotes a quoted string, handling common escapes. */
const unquote = (raw: string): string => {
  const quote = raw[0]
  if (quote !== "'" && quote !== '"') return raw
  const body = raw.slice(1, -1)
  if (quote === "'") {
    // Single-quoted YAML doubles `''` as an escaped quote; no other escapes.
    return body.replace(/''/g, "'")
  }
  let out = ''
  for (let i = 0; i < body.length; i += 1) {
    const ch = body.charAt(i)
    if (ch !== '\\') {
      out += ch
      continue
    }
    const next = body.charAt(i + 1)
    i += 1
    switch (next) {
      case 'n': out += '\n'; break
      case 't': out += '\t'; break
      case 'r': out += '\r'; break
      case '\\': out += '\\'; break
      case '"': out += '"'; break
      case "'": out += "'"; break
      case '0': out += '\0'; break
      case 'u': {
        const hex = body.slice(i + 1, i + 5)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(Number.parseInt(hex, 16))
          i += 4
        } else {
          out += '\\u'
        }
        break
      }
      default: out += next
    }
  }
  return out
}

/** Parses a scalar value; returns the raw string when not a known literal. */
const parseScalar = (raw: string): FmValue => {
  const trimmed = raw.trim()
  if (trimmed === '') return ''
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null' || trimmed === '~') return null
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return unquote(trimmed)
  }
  if (/^-?\d+$/.test(trimmed)) {
    const n = Number(trimmed)
    if (Number.isSafeInteger(n)) return n
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    const n = Number(trimmed)
    if (Number.isFinite(n)) return n
  }
  return trimmed
}

const parseFlowArray = (raw: string): FmValue[] | null => {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null
  const inner = trimmed.slice(1, -1).trim()
  if (inner === '') return []
  let inQuote: string | null = null
  let depth = 0
  let current = ''
  const elements: FmValue[] = []
  for (const ch of inner) {
    if (inQuote) {
      current += ch
      if (ch === inQuote) inQuote = null
      continue
    }
    if (ch === "'" || ch === '"') {
      inQuote = ch
      current += ch
      continue
    }
    if (ch === '[' || ch === '{') depth += 1
    else if (ch === ']' || ch === '}') depth -= 1
    if (ch === ',' && depth === 0) {
      elements.push(parseScalar(current))
      current = ''
      continue
    }
    current += ch
  }
  // Unterminated quotes/brackets mean a malformed flow array (fail-closed).
  if (inQuote !== null || depth !== 0) return null
  elements.push(parseScalar(current))
  return elements
}

/** Parses the inline value after `key:` or `- `; empty string when empty. */
const parseInlineValue = (raw: string): FmValue => {
  const trimmed = raw.trim()
  if (trimmed === '') return ''
  if (trimmed.startsWith('[')) {
    const flow = parseFlowArray(trimmed)
    if (flow) return flow
    throw new Error(`Malformed flow array: ${trimmed}`)
  }
  const quoted = trimmed.startsWith('"') || trimmed.startsWith("'")
  return parseScalar(quoted ? trimmed : stripTrailingComment(trimmed))
}

/** True when `rest` is an inline mapping entry like `id: src-1`. */
const isInlineMap = (rest: string): boolean =>
  /^[A-Za-z_][A-Za-z0-9_-]*:(?:\s|$)/.test(rest)

/** A line tokenizer step. */
interface Line {
  indent: number
  content: string
}

/**
 * Parses a block of lines at a given indentation. The block is a mapping
 * when its first meaningful line is `key: …`, or an array when it starts
 * with `- …`.
 */
const parseBlock = (
  lines: Line[],
  start: number,
  indent: number,
): { node: FmValue; next: number } => {
  let i = start
  // Skip blank/comment lines before deciding the block kind.
  while (i < lines.length) {
    const line = lines.at(i) ?? { indent: 0, content: '' }
    if (line.indent < 0) throw new Error('Tabs are not supported in frontmatter indentation')
    if (line.indent < indent) return { node: {}, next: i }
    if (line.indent > indent) throw new Error(`Unexpected indentation at line ${i + 1}`)
    const content = line.content
    if (content !== '' && !content.startsWith('#')) break
    i += 1
  }
  const first = lines.at(i)
  if (first === undefined) return { node: {}, next: i }

  if (first.content.startsWith('- ')) {
    // Array block.
    const items: FmValue[] = []
    while (i < lines.length) {
      const itemLine = lines.at(i) ?? { indent: 0, content: '' }
      if (itemLine.indent < 0) throw new Error('Tabs are not supported in frontmatter indentation')
      if (itemLine.indent !== indent || !itemLine.content.startsWith('- ')) break
      const rest = itemLine.content.slice(2).trimStart()
      if (rest === '' || rest.startsWith('#')) {
        items.push('')
        i += 1
        continue
      }
      const nextLine = lines.at(i + 1)
      const hasNested = nextLine !== undefined && nextLine.indent > indent && nextLine.indent >= 0
      if (hasNested && isInlineMap(rest)) {
        const colon = rest.indexOf(':')
        const key = rest.slice(0, colon).trim()
        const restValue = rest.slice(colon + 1).trim()
        const nested = parseBlock(lines, i + 1, nextLine.indent)
        if (restValue === '') {
          // `key:` with a nested block — the block itself is the value.
          items.push({ [key]: nested.node })
        } else if (
          typeof nested.node === 'object' && nested.node !== null && !Array.isArray(nested.node)
        ) {
          // `key: value` followed by more keys at a deeper indent — merge them
          // into one item map instead of nesting the remainder under the key.
          // Spread (not Object.assign) so a literal `__proto__` key stays a
          // plain data property instead of invoking the prototype setter.
          items.push({ [key]: parseInlineValue(restValue), ...nested.node })
        } else {
          items.push({ [key]: parseInlineValue(restValue) })
        }
        i = nested.next
        continue
      }
      if (hasNested) {
        const nested = parseBlock(lines, i + 1, nextLine.indent)
        items.push(nested.node)
        i = nested.next
        continue
      }
      if (isInlineMap(rest)) {
        const colon = rest.indexOf(':')
        const key = rest.slice(0, colon).trim()
        items.push({ [key]: parseInlineValue(rest.slice(colon + 1)) })
      } else {
        items.push(parseInlineValue(rest))
      }
      i += 1
    }
    return { node: items, next: i }
  }

  // Mapping block. Built as a Map so arbitrary YAML keys (including
  // `__proto__`/`constructor`) stay plain data and never hit object setters;
  // converted to a plain record at the return boundary.
  const map = new Map<string, FmValue>()
  while (i < lines.length) {
    const line = lines.at(i) ?? { indent: 0, content: '' }
    if (line.indent < 0) throw new Error('Tabs are not supported in frontmatter indentation')
    if (line.indent < indent) break
    if (line.indent > indent) throw new Error(`Unexpected indentation at line ${i + 1}`)
    const content = line.content
    if (content === '' || content.startsWith('#')) {
      i += 1
      continue
    }
    if (content.startsWith('- ')) {
      // A list inside a mapping block belongs to the previous key's value;
      // reaching it here means the caller sent us to the wrong indent.
      throw new Error(`List item at line ${i + 1} has no containing key`)
    }
    const colon = content.indexOf(':')
    if (colon === -1) {
      throw new Error(`Expected a mapping entry at line ${i + 1}`)
    }
    const key = content.slice(0, colon).trim()
    const rest = content.slice(colon + 1).trimStart()
    if (key === '') throw new Error(`Empty key at line ${i + 1}`)
    const nextLine = lines.at(i + 1)
    const hasNested = nextLine !== undefined && nextLine.indent > indent && nextLine.indent >= 0
    if (rest === '' || rest.startsWith('#')) {
      if (hasNested) {
        const nested = parseBlock(lines, i + 1, nextLine.indent)
        map.set(key, nested.node)
        i = nested.next
      } else {
        map.set(key, '')
        i += 1
      }
      continue
    }
    map.set(key, parseInlineValue(rest))
    i += 1
  }
  return { node: Object.fromEntries(map), next: i }
}

/**
 * Parses a YAML-subset frontmatter document (no `---` fences).
 * @param text - Frontmatter text between the fences.
 * @returns Parsed object, or an error description.
 */
export const parseFrontmatter = (text: string): FmResult => {
  const lines: Line[] = []
  for (const raw of text.split('\n')) {
    const { indent, content } = indentOf(raw)
    lines.push({ indent, content })
  }
  try {
    const { node, next } = parseBlock(lines, 0, 0)
    if (next < lines.length) {
      return { ok: false, error: `Unexpected content after frontmatter block (line ${next + 1})` }
    }
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      return { ok: false, error: 'Frontmatter must be a mapping' }
    }
    return { ok: true, data: node }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'invalid frontmatter' }
  }
}

/** Splits markdown into frontmatter and body; null frontmatter when absent. */
export const splitFrontmatter = (
  content: string,
): { frontmatter: string | null; body: string } => {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(content)
  if (!match) return { frontmatter: null, body: content }
  return { frontmatter: match.at(1) ?? '', body: match.at(2) ?? '' }
}
