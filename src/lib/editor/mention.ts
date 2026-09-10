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

/** Characters stripped from a mention's display name so the token stays well-formed markdown. */
const MENTION_NAME_INVALID = /[[\]]/g

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

/** Returns every complete mention token in the content, in source order. */
export const findMentionTokens = (content: string): MentionToken[] => {
  const tokens: MentionToken[] = []
  MENTION_TOKEN_PATTERN.lastIndex = 0
  let match = MENTION_TOKEN_PATTERN.exec(content)
  while (match !== null) {
    const start = match.index
    const raw = match[0]
    tokens.push({
      entityId: decodeMentionId(match[2]),
      name: match[1],
      start,
      end: start + raw.length,
      raw,
    })
    match = MENTION_TOKEN_PATTERN.exec(content)
  }
  return tokens
}

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
  const tokens = findMentionTokens(content)
  // Caret inside a complete token? That is editing raw token text, not typing a mention.
  if (isInsideToken(caret, tokens)) return NO_MENTION_TRIGGER

  // Scan backwards for the nearest '@' that is not part of a token.
  const at = findMentionAt(content, caret, tokens)
  if (at === -1) return NO_MENTION_TRIGGER

  const query = content.slice(at + 1, caret)
  if (!isValidMentionQuery(query)) return NO_MENTION_TRIGGER
  return { active: true, start: at, query }
}

/** Encode an entity id for a mention link destination: parens and other URI
 * reserved chars would otherwise terminate the markdown token early. */
const encodeMentionId = (entityId: string): string =>
  encodeURIComponent(entityId).replace(/\(/g, '%28').replace(/\)/g, '%29')

/** Builds the raw mention token for an entity, sanitizing bracket chars. */
export const buildMentionToken = (entityId: string, name: string): string =>
  `[@${name.replace(MENTION_NAME_INVALID, '')}](${MENTION_SCHEME}${encodeMentionId(entityId)})`

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