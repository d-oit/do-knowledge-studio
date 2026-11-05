import type { Entity } from '@/lib/studio/types'
import {
  buildMentionToken,
  findMentionTokens,
  getMentionCodeRanges,
} from './mention'

/**
 * `[[Wikilink]]` support (issue #1055) — pure, framework-free helpers.
 *
 * Wikilinks are input/output syntax only. Storage keeps the canonical
 * `[@Name](dks://entity/<id>)` token (see `mention.ts`), so sync, backlinks,
 * and link derivation are unchanged: `[[Name]]` resolves to an entity and is
 * written as the token at save time, and tokens render back as `[[Name]]`
 * on Markdown export.
 *
 * Alias resolution order for `[[alias]]`: exact entity-name match
 * (case-insensitive), then exact tag match (case-insensitive). Tags double as
 * lightweight aliases so no schema migration is needed; #1054 maps Obsidian
 * frontmatter `aliases` into tags.
 */

/** Matches `[[Name]]` and `[[Name|display text]]` (no nesting). */
const WIKILINK_PATTERN = /\[\[([^\][|]+)(?:\|([^\]]+))?\]\]/g

/** Shortest entity name that participates in unlinked-mention scanning. */
const UNLINKED_MENTION_MIN_NAME_LENGTH = 3

/** Characters of context kept on each side of an unlinked-mention snippet. */
const UNLINKED_SNIPPET_RADIUS = 60

/** Maximum unlinked mentions reported for one entity. */
const UNLINKED_MENTION_LIMIT = 20

/** A parsed `[[...]]` occurrence in raw content. */
export interface WikilinkToken {
  /** Name between the brackets (before an optional `|`). */
  name: string
  /** Explicit display text after `|`, or null for `[[Name]]`. */
  display: string | null
  /** Index of the opening `[[` in the raw content. */
  start: number
  /** Index just past the closing `]]`. */
  end: number
  /** The full raw `[[...]]` text. */
  raw: string
}

/** True when the character at `index` is escaped by an odd run of backslashes. */
const isEscapedAt = (content: string, index: number): boolean => {
  let backslashes = 0
  for (let i = index - 1; i >= 0 && content[i] === '\\'; i -= 1) backslashes += 1
  return backslashes % 2 === 1
}

/**
 * Collects every `[[...]]` occurrence in source order. Occurrences inside
 * code (fenced blocks, inline spans) or with an escaped opener are skipped:
 * Markdown renders those as literal text, so they must never link.
 */
export const findWikilinkTokens = (content: string): WikilinkToken[] => {
  const ranges = getMentionCodeRanges(content)
  const inCode = (start: number, end: number): boolean =>
    ranges.some((range) => range.start < end && range.end > start)
  const tokens: WikilinkToken[] = []
  WIKILINK_PATTERN.lastIndex = 0
  let match = WIKILINK_PATTERN.exec(content)
  while (match !== null) {
    const start = match.index
    const raw = match[0]
    if (!inCode(start, start + raw.length) && !isEscapedAt(content, start)) {
      tokens.push({
        name: (match[1] ?? '').trim(),
        display: match[2] === undefined ? null : match[2].trim(),
        start,
        end: start + raw.length,
        raw,
      })
    }
    match = WIKILINK_PATTERN.exec(content)
  }
  return tokens.filter((t) => t.name.length > 0)
}

/**
 * Resolves a wikilink name to an entity id: exact name match first
 * (case-insensitive), then exact tag match (case-insensitive). Returns
 * undefined when nothing matches. Deterministic in entity order.
 */
export const resolveWikilinkTarget = (
  name: string,
  entities: Entity[],
  excludeId?: string,
): string | undefined => {
  const wanted = name.trim().toLowerCase()
  if (wanted === '') return undefined
  const eligible = excludeId === undefined ? entities : entities.filter((e) => e.id !== excludeId)
  const byName = eligible.find((e) => e.name.trim().toLowerCase() === wanted)
  if (byName) return byName.id
  const byTag = eligible.find((e) => e.tags.some((t) => t.trim().toLowerCase() === wanted))
  return byTag?.id
}

export interface WikilinkConversion {
  /** Content with every resolvable `[[...]]` replaced by a canonical token. */
  text: string
  /** Ids the conversion linked (deduplicated, in first-appearance order). */
  convertedIds: string[]
  /** Names left as literal text because nothing matched. */
  unresolved: string[]
}

/**
 * Replaces every resolvable `[[Name]]` / `[[Name|display]]` with the canonical
 * `[@...](dks://entity/<id>)` token. Explicit display text is kept; otherwise
 * the entity's current name is used. Unresolvable names stay literal so a
 * later import pass (#1054) can offer them as stub candidates.
 */
export const convertWikilinksToTokens = (
  content: string,
  entities: Entity[],
  excludeId?: string,
): WikilinkConversion => {
  const entityById = new Map(entities.map((e) => [e.id, e]))
  const convertedIds: string[] = []
  const seenConverted = new Set<string>()
  const unresolved: string[] = []
  const seenUnresolved = new Set<string>()
  const tokens = findWikilinkTokens(content)
  if (tokens.length === 0) return { text: content, convertedIds, unresolved }
  // Replace from the end so earlier indexes stay valid.
  const descending = [...tokens].sort((a, b) => b.start - a.start)
  let text = content
  for (const token of descending) {
    const targetId = resolveWikilinkTarget(token.name, entities, excludeId)
    if (targetId === undefined) {
      if (!seenUnresolved.has(token.name)) {
        seenUnresolved.add(token.name)
        unresolved.push(token.name)
      }
      continue
    }
    const entity = entityById.get(targetId)
    const display = token.display ?? entity?.name ?? token.name
    text = text.slice(0, token.start) + buildMentionToken(targetId, display) + text.slice(token.end)
    if (!seenConverted.has(targetId)) {
      seenConverted.add(targetId)
      convertedIds.push(targetId)
    }
  }
  // convertedIds collected in reverse document order above; restore it.
  convertedIds.reverse()
  unresolved.reverse()
  return { text, convertedIds, unresolved }
}

/**
 * Renders canonical mention tokens as `[[Name]]` using each target's live
 * name — the Markdown export shape from #1055. Unknown ids keep their stored
 * display text so export never drops a link silently.
 */
export const renderTokensAsWikilinks = (content: string, entities: Entity[]): string => {
  const tokens = findMentionTokens(content)
  if (tokens.length === 0) return content
  const entityById = new Map(entities.map((e) => [e.id, e]))
  const descending = [...tokens].sort((a, b) => b.start - a.start)
  let text = content
  for (const token of descending) {
    const name = entityById.get(token.entityId)?.name ?? token.name
    const safe = name.replace(/[[\]]/g, '')
    text = `${text.slice(0, token.start)}[[${safe}]]${text.slice(token.end)}`
  }
  return text
}

/**
 * Rewrites the display text of one entity's tokens from `oldName` to
 * `newName`, touching only tokens whose display still shows the old name
 * (custom display text is never clobbered). Rename itself cannot break links:
 * tokens stay id-based either way.
 */
export const updateMentionDisplayNames = (
  content: string,
  entityId: string,
  oldName: string,
  newName: string,
): string => {
  const tokens = findMentionTokens(content).filter(
    (t) => t.entityId === entityId && t.name === oldName,
  )
  if (tokens.length === 0) return content
  const descending = [...tokens].sort((a, b) => b.start - a.start)
  let text = content
  for (const token of descending) {
    text = text.slice(0, token.start) + buildMentionToken(entityId, newName) + text.slice(token.end)
  }
  return text
}

/** One unlinked mention: a source entity whose prose names the target without linking it. */
export interface UnlinkedMention {
  /** Id of the entity whose content names the target. */
  sourceId: string
  /** Name of the source entity (for list display without a lookup). */
  sourceName: string
  /** Short surrounding context of the first plain-text occurrence. */
  snippet: string
}

/** Plain-text occurrence ranges of `needle` in `content` (case-insensitive). */
const findPlainOccurrences = (content: string, needle: string): number[] => {
  const haystack = content.toLowerCase()
  const want = needle.toLowerCase()
  const indexes: number[] = []
  let from = 0
  while (from <= haystack.length - want.length) {
    const at = haystack.indexOf(want, from)
    if (at === -1) break
    indexes.push(at)
    from = at + want.length
  }
  return indexes
}

/** True when `[start, end)` overlaps any of the given spans. */
const overlapsSpans = (start: number, end: number, spans: readonly { start: number; end: number }[]): boolean =>
  spans.some((s) => s.start < end && s.end > start)

/**
 * Finds entities whose prose names `targetId` (by entity name or tag) without
 * a mention token pointing at it — the "Unlinked mentions" companion to the
 * backlink list. Occurrences inside code or inside any mention token are not
 * counted. Bounded by `UNLINKED_MENTION_LIMIT`; short names (below
 * `UNLINKED_MENTION_MIN_NAME_LENGTH`) are skipped as noise. Runs on plain
 * substring scanning, so a 2k-note corpus stays main-thread friendly.
 */
export const findUnlinkedMentions = (entities: Entity[], targetId: string): UnlinkedMention[] => {
  const target = entities.find((e) => e.id === targetId)
  if (!target) return []
  const needles = [target.name, ...target.tags]
    .map((n) => n.trim())
    .filter((n) => n.length >= UNLINKED_MENTION_MIN_NAME_LENGTH)
  if (needles.length === 0) return []
  const results: UnlinkedMention[] = []
  for (const source of entities) {
    if (source.id === targetId) continue
    if (results.length >= UNLINKED_MENTION_LIMIT) break
    const linkedIds = new Set(findMentionTokens(source.content).map((t) => t.entityId))
    if (linkedIds.has(targetId)) continue
    const tokenSpans = findMentionTokens(source.content)
    const codeRanges = getMentionCodeRanges(source.content)
    const hit = needles
      .flatMap((needle) => findPlainOccurrences(source.content, needle).map((at) => ({ at, needle })))
      .find(({ at, needle }) => !overlapsSpans(at, at + needle.length, tokenSpans) && !overlapsSpans(at, at + needle.length, codeRanges))
    if (!hit) continue
    const start = Math.max(0, hit.at - UNLINKED_SNIPPET_RADIUS)
    const end = Math.min(source.content.length, hit.at + hit.needle.length + UNLINKED_SNIPPET_RADIUS)
    results.push({
      sourceId: source.id,
      sourceName: source.name,
      snippet: `${start > 0 ? '…' : ''}${source.content.slice(start, end).replace(/\s+/g, ' ').trim()}${end < source.content.length ? '…' : ''}`,
    })
  }
  return results
}

/**
 * Turns the first plain-text occurrence of the target's name (or one of its
 * tags) in `sourceContent` into a canonical mention token — the one-click
 * "Link" action behind an unlinked mention. Returns null when there is
 * nothing linkable (already linked, or only code/token occurrences remain).
 */
export const linkFirstUnlinkedOccurrence = (
  sourceContent: string,
  target: Entity,
): string | null => {
  const linkedIds = new Set(findMentionTokens(sourceContent).map((t) => t.entityId))
  if (linkedIds.has(target.id)) return null
  const tokenSpans = findMentionTokens(sourceContent)
  const codeRanges = getMentionCodeRanges(sourceContent)
  const needles = [target.name, ...target.tags].map((n) => n.trim()).filter((n) => n.length > 0)
  for (const needle of needles) {
    const hit = findPlainOccurrences(sourceContent, needle).find(
      (at) => !overlapsSpans(at, at + needle.length, tokenSpans) && !overlapsSpans(at, at + needle.length, codeRanges),
    )
    if (hit === undefined) continue
    const actual = sourceContent.slice(hit, hit + needle.length)
    return (
      sourceContent.slice(0, hit) + buildMentionToken(target.id, actual) + sourceContent.slice(hit + needle.length)
    )
  }
  return null
}
