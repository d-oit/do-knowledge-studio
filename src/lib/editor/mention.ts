import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Entity } from '@/lib/studio/types'

/**
 * @mention entity linking (N3, issue #753) — pure, framework-free helpers.
 *
 * Token convention: a mention is an inline markdown link with a reserved
 * `dks://entity/<id>` URI scheme:
 *
 *   [@Entity Name](dks://entity/e1)
 *
 * Why this shape:
 * - The textarea stays plain, editable markdown (no hidden ranges/proxies).
 * - react-markdown renders the link as-is; the editor preview supplies a
 *   custom `a` component that styles mention links as chips (editor-view.tsx).
 * - A single regex round-trips tokens, so links are DERIVED from the FINAL
 *   content at save time — deleting the mention text automatically removes
 *   the link (no accumulation, no desync).
 */

/** Relation written on the source entity for each parsed mention. */
export const MENTION_LINK_RELATION = 'mentions' as const

/** Reciprocal relation written on the mentioned entity, pointing back at the source. */
export const MENTIONED_IN_RELATION = 'mentioned-in' as const

/** Reserved URI scheme prefix that marks a mention link. */
export const MENTION_SCHEME = 'dks://entity/'

/** Matches a complete mention token: [@Name](dks://entity/<id>). */
const MENTION_TOKEN_PATTERN = /\[@([^\]]+)\]\(dks:\/\/entity\/([^)]+)\)/g

/**
 * The Markdown pipeline the editor preview renders with (react-markdown +
 * remark-gfm), reused here so code detection agrees with the rendered document
 * instead of approximating CommonMark by hand.
 */
const markdownProcessor = unified().use(remarkParse).use(remarkGfm)

/** A range of content that Markdown renders as code. */
interface CodeRange {
  start: number
  end: number
  /**
   * True when the range runs to the end of the content without closing (an
   * unclosed fence, or a trailing indented block). Typing at that end continues
   * the block, so the caret still counts as inside; a closed fence or an inline
   * span does not.
   */
  openEnded: boolean
}

/** Line feed, built from its code point to keep this module escape-free. */
const LINE_FEED = String.fromCharCode(10)

/** Tab character, built from its code point to keep this module escape-free. */
const TAB_CHARACTER = String.fromCharCode(9)

/** The mdast surface this module reads: node type, children, and source offsets. */
interface MarkdownNode {
  type: string
  position?: { start: { offset?: number }; end: { offset?: number } }
  children?: MarkdownNode[]
}

/** Node types the renderer shows as code: fenced/indented blocks and inline spans. */
const CODE_NODE_TYPES = new Set(['code', 'inlineCode'])

/**
 * Cheap guard before parsing: code needs a backtick/tilde delimiter, a tab, or
 * an indented line. Indentation at the start of a source line, behind a
 * block-quote marker, or after a list marker all open an indented code block,
 * and list-item continuation lines are indented too — so any of those line
 * shapes parses. Only flat prose skips the parser.
 */
const CODE_LEADING_CHARACTERS = new Set([' ', '>', '-', '+', '*'])

const mayContainCode = (content: string): boolean => {
  if (content.includes('`') || content.includes('~') || content.includes(TAB_CHARACTER)) {
    return true
  }
  return content.split(LINE_FEED).some((line) => {
    const first = line[0]
    if (first === undefined) return false
    return CODE_LEADING_CHARACTERS.has(first) || (first >= '0' && first <= '9')
  })
}

/** Length of a bare fence run on `line` (0 when the line is not a delimiter). */
const fenceRunLength = (line: string): number => {
  const trimmed = line.trim()
  if (trimmed.length < 3) return 0
  const marker = trimmed[0]
  if (marker !== '`' && marker !== '~') return 0
  for (const character of trimmed) {
    if (character !== marker) return 0
  }
  return trimmed.length
}

/** Length of the fence run that opens `line` (info string allowed), or 0. */
const openingFenceRunLength = (line: string): number => {
  const trimmed = line.trimStart()
  const marker = trimmed[0]
  if (marker !== '`' && marker !== '~') return 0
  let run = 0
  while (trimmed[run] === marker) run += 1
  return run >= 3 ? run : 0
}

/**
 * True when `source` is a fenced block closed by its final line. Markdown
 * requires the closing run to be at least as long as the opening one, so a
 * shorter trailing run is content and the block stays open; indented blocks
 * have no fence and are never closed this way.
 */
const endsWithFenceDelimiter = (source: string): boolean => {
  const lines = source.split(LINE_FEED)
  if (lines.length < 2) return false
  const opening = openingFenceRunLength(lines[0])
  if (opening === 0) return false
  return fenceRunLength(lines[lines.length - 1]) >= opening
}

/** Collects the source range of every code node, blocks and inline spans alike. */
const collectCodeRanges = (
  node: MarkdownNode,
  ranges: CodeRange[],
  content: string,
): void => {
  if (CODE_NODE_TYPES.has(node.type)) {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) return
    ranges.push({
      start,
      end,
      openEnded:
        node.type === 'code' &&
        end === content.length &&
        !endsWithFenceDelimiter(content.slice(start, end)),
    })
    return
  }
  for (const child of node.children ?? []) collectCodeRanges(child, ranges, content)
}

/**
 * Ranges of `content` that the editor preview renders as code. Parsing with the
 * preview's own pipeline keeps mention matching in step with the rendered
 * document: fenced and indented blocks, inline spans, escaped backticks, and
 * invalid fence info strings all follow CommonMark rather than a hand-rolled
 * approximation.
 *
 * The last result is cached: the caret path calls this on every keystroke, and
 * the content is unchanged between caret moves.
 */
let cachedCodeSource: string | null = null
let cachedCodeRanges: CodeRange[] = []

const findCodeRanges = (content: string): CodeRange[] => {
  if (content === cachedCodeSource) return cachedCodeRanges
  const ranges: CodeRange[] = []
  if (mayContainCode(content)) {
    collectCodeRanges(markdownProcessor.parse(content), ranges, content)
  }
  cachedCodeSource = content
  cachedCodeRanges = ranges
  return ranges
}

/** True when `position` falls inside a code range. */
const isInCodeRange = (position: number, ranges: CodeRange[]): boolean =>
  ranges.some((range) => position >= range.start && position < range.end)

/**
 * True when the caret sits inside code. A caret counts as inside only strictly
 * between a range's edges, or at the end of the content while a block is still
 * open there: a caret placed just after a closing delimiter is outside the
 * rendered span, so the picker can open again.
 */
const isCaretInCode = (caret: number, ranges: CodeRange[]): boolean =>
  ranges.some((range) => caret > range.start && caret < range.end) ||
  ranges.some((range) => range.openEnded && caret === range.end)

/** True when the character at `index` is escaped by an odd run of backslashes. */
const isEscaped = (content: string, index: number): boolean => {
  let backslashes = 0
  for (let i = index - 1; i >= 0 && content[i] === '\\'; i -= 1) backslashes += 1
  return backslashes % 2 === 1
}

/** Characters stripped from a mention's display name so the token stays well-formed markdown. */
const MENTION_NAME_INVALID = /[[\]]/g

/** A lone backslash in a display name would escape the token's closing `]`
 * in Markdown, breaking the link. Doubled, it renders as a literal `\`. */
const escapeMarkdownBackslashes = (name: string): string => name.replace(/\\/g, '\\\\')

/** A parsed mention token located in the raw content. */
export interface MentionToken {
  entityId: string
  name: string
  /** Index of the opening `[` in the raw content. */
  start: number
  /** Index just past the closing `)`. */
  end: number
  /** The full raw token text. */
  raw: string
}

/** Result of checking whether the caret is in an active mention-typing context. */
export interface MentionTrigger {
  /** Whether a mention picker should be open at the caret. */
  active: boolean
  /** Index of the `@` that started the current query (or -1 when inactive). */
  start: number
  /** Text between the `@` and the caret ('' right after typing '@'). */
  query: string
}

/** A single entry in an entity's `links` array. */
export interface MentionLink {
  targetId: string
  relation: string
}

/** A mention resolved to a live entity at save time. */
export interface ResolvedMention {
  entityId: string
  name: string
}

/** Result of deriving mention links from the final content at save time. */
export interface ExtractedMentions {
  /** Links to append to the saved entity (`relation: 'mentions'`). */
  mentionLinks: MentionLink[]
  /** Deduplicated, resolved mentions for backlink writing. */
  mentions: ResolvedMention[]
}

/** The canonical inert trigger (caret not in a mention context). */
export const NO_MENTION_TRIGGER: MentionTrigger = { active: false, start: -1, query: '' }

/** Decode a mention-link destination back to an entity id; legacy tokens may
 * hold raw ids with invalid escape sequences, so falls back to the raw form. */
const decodeMentionId = (raw: string): string => {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * Collects every complete mention token in the content, in source order.
 * Tokens inside code (fenced blocks, inline spans) and tokens whose opening
 * bracket is escaped are skipped: Markdown renders those as literal text, so
 * they must not create links or backlinks.
 */
const collectMentionTokens = (content: string, codeRanges: CodeRange[]): MentionToken[] => {
  const tokens: MentionToken[] = []
  MENTION_TOKEN_PATTERN.lastIndex = 0
  let match = MENTION_TOKEN_PATTERN.exec(content)
  while (match !== null) {
    const start = match.index
    const raw = match[0]
    if (!isInCodeRange(start, codeRanges) && !isEscaped(content, start)) {
      tokens.push({
        entityId: decodeMentionId(match[2]),
        name: match[1],
        start,
        end: start + raw.length,
        raw,
      })
    }
    match = MENTION_TOKEN_PATTERN.exec(content)
  }
  return tokens
}

/** Returns every complete, link-creating mention token in the content, in source order. */
export const findMentionTokens = (content: string): MentionToken[] =>
  collectMentionTokens(content, findCodeRanges(content))

/** True when `position` falls strictly inside a complete mention token. */
const isInsideToken = (position: number, tokens: MentionToken[]): boolean =>
  tokens.some((t) => position > t.start && position < t.end)

/**
 * Index of the nearest `@` at or before `caret` that is not part of a token,
 * or -1 when there is none.
 */
const findMentionAt = (content: string, caret: number, tokens: MentionToken[]): number => {
  for (let i = caret - 1; i >= 0; i -= 1) {
    if (content[i] !== '@') continue
    if (isInsideToken(i, tokens)) continue
    return i
  }
  return -1
}

/** A `@`-query is only active when it contains no whitespace or `]`. */
const isValidMentionQuery = (query: string): boolean =>
  !/\s/.test(query) && !query.includes(']')

/**
 * Detects an active mention-typing context at the caret.
 *
 * Active when the caret is preceded by an `@` (not inside an existing token)
 * with no whitespace or `]` between it and the caret. Whitespace ends the
 * trigger so prose after a stray `@` doesn't keep the picker open, and `]`
 * terminates a manually-typed markdown link.
 */
export const getMentionTrigger = (content: string, caret: number): MentionTrigger => {
  if (caret <= 0) return NO_MENTION_TRIGGER
  // Cheap path first: without a valid `@` query before the caret there is no
  // trigger, and that test needs no Markdown parsing — the expensive step is
  // reserved for the moment a mention is actually being typed. Tokens are
  // collected unfiltered here; a caret inside a token that sits in code is
  // rejected by the code check below, so the filter cannot change the outcome.
  const tokens = collectMentionTokens(content, [])
  const at = findMentionAt(content, caret, tokens)
  if (at === -1) return NO_MENTION_TRIGGER

  const query = content.slice(at + 1, caret)
  if (!isValidMentionQuery(query)) return NO_MENTION_TRIGGER

  // A token typed inside code never links (findMentionTokens ignores code), so
  // the picker stays closed there instead of inserting an inert token.
  if (isCaretInCode(caret, findCodeRanges(content))) return NO_MENTION_TRIGGER

  // Caret inside a complete token? That is editing raw token text, not typing a mention.
  if (isInsideToken(caret, tokens)) return NO_MENTION_TRIGGER
  return { active: true, start: at, query }
}

/** Encode an entity id for a mention link destination: parens and other URI
 * reserved chars would otherwise terminate the markdown token early. */
const encodeMentionId = (entityId: string): string =>
  encodeURIComponent(entityId).replace(/\(/g, '%28').replace(/\)/g, '%29')

/** Builds the raw mention token for an entity, sanitizing bracket chars and
 * escaping backslashes so the emitted Markdown link is always well-formed. */
export const buildMentionToken = (entityId: string, name: string): string =>
  `[@${escapeMarkdownBackslashes(name).replace(MENTION_NAME_INVALID, '')}](${MENTION_SCHEME}${encodeMentionId(entityId)})`

/**
 * Replaces the active trigger span (`@query`) with the mention token.
 * Returns the new content and the caret position just past the token.
 */
export const insertMentionToken = (
  content: string,
  trigger: MentionTrigger,
  entity: { id: string; name: string },
): { text: string; selection: number } => {
  if (!trigger.active) return { text: content, selection: trigger.start }
  const token = buildMentionToken(entity.id, entity.name)
  const caret = trigger.start + 1 + trigger.query.length
  const text = content.slice(0, trigger.start) + token + content.slice(caret)
  return { text, selection: trigger.start + token.length }
}

/** Strips mention tokens from the content (optionally only those for one entity). */
export const removeMentionTokens = (content: string, entityId?: string): string => {
  const tokens = findMentionTokens(content).filter(
    (t) => entityId === undefined || t.entityId === entityId,
  )
  if (tokens.length === 0) return content
  // Remove from the end so earlier indexes stay valid.
  const descending = [...tokens].sort((a, b) => b.start - a.start)
  let result = content
  for (const token of descending) {
    result = result.slice(0, token.start) + result.slice(token.end)
  }
  return result
}

/**
 * Derives mention links from the final content at save time.
 * Unresolvable ids (deleted/imported-stale) and the excluded self id are skipped.
 */
export const extractMentionLinks = (
  content: string,
  entities: Entity[],
  excludeId?: string,
): ExtractedMentions => {
  const mentions: ResolvedMention[] = []
  const seen = new Set<string>()
  const entityById = new Map(entities.map((e) => [e.id, e]))
  for (const token of findMentionTokens(content)) {
    if (token.entityId === excludeId) continue
    const entity = entityById.get(token.entityId)
    if (!entity || seen.has(token.entityId)) continue
    seen.add(token.entityId)
    mentions.push({ entityId: token.entityId, name: entity.name })
  }
  return {
    mentionLinks: mentions.map((m) => ({ targetId: m.entityId, relation: MENTION_LINK_RELATION })),
    mentions,
  }
}

/**
 * Reconciles derived mention links against the entity's existing links.
 * Mention links (`relation: 'mentions'`) are derived state: entries whose
 * token no longer appears in the content are dropped, missing ones appended,
 * and the remaining order is preserved. Manually authored relations (any
 * other relation) are never touched. Never mutates the input arrays.
 */
export const mergeMentionLinks = (
  existing: MentionLink[],
  mentionLinks: MentionLink[],
): MentionLink[] => {
  const derivedKeys = new Set(
    mentionLinks.map((l) => JSON.stringify([l.targetId, l.relation])),
  )
  const keptManual = existing.filter(
    (l) => l.relation !== MENTION_LINK_RELATION || derivedKeys.has(JSON.stringify([l.targetId, l.relation])),
  )
  const result = [...keptManual]
  const present = new Set(keptManual.map((l) => JSON.stringify([l.targetId, l.relation])))
  for (const link of mentionLinks) {
    const key = JSON.stringify([link.targetId, link.relation])
    if (present.has(key)) continue
    present.add(key)
    result.push(link)
  }
  return result
}

/**
 * Reconciles reciprocal `mentioned-in` backlinks across the entity list for a
 * source entity: mentioned targets gain `{ targetId: sourceId, relation:
 * 'mentioned-in' }`, targets no longer mentioned lose it. Returns ONLY the
 * entities whose links changed (callers write them back via `saveEntity`).
 * Backlink-touch bumps `updatedAt`, matching the existing link-write pattern
 * (see mindmap-view `commitEntity`).
 */
export const applyMentionBacklinks = (
  entities: Entity[],
  sourceId: string,
  mentionedIds: ReadonlySet<string>,
): Entity[] => {
  const now = new Date().toISOString()
  const changed: Entity[] = []
  for (const entity of entities) {
    if (entity.id === sourceId) continue
    const hasBacklink = entity.links.some(
      (l) => l.targetId === sourceId && l.relation === MENTIONED_IN_RELATION,
    )
    const shouldHave = mentionedIds.has(entity.id)
    if (hasBacklink === shouldHave) continue
    const links = shouldHave
      ? [...entity.links, { targetId: sourceId, relation: MENTIONED_IN_RELATION }]
      : entity.links.filter(
          (l) => !(l.targetId === sourceId && l.relation === MENTIONED_IN_RELATION),
        )
    changed.push({ ...entity, links, updatedAt: now })
  }
  return changed
}