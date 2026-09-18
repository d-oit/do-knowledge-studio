import { describe, it, expect } from 'vitest'
import type { Entity } from '@/lib/studio/types'
import {
  MENTION_LINK_RELATION,
  MENTIONED_IN_RELATION,
  buildMentionToken,
  extractMentionLinks,
  findMentionTokens,
  getMentionTrigger,
  insertMentionToken,
  mergeMentionLinks,
  removeMentionTokens,
  applyMentionBacklinks,
} from './mention'

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'e-1',
  name: 'Test Entity',
  type: 'note',
  description: 'A test entity',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

const token = (id: string, name: string): string => buildMentionToken(id, name)

/** Newline, built from its code point so the content under test is unambiguous. */
const NEWLINE = String.fromCharCode(10)
/** Tab character, built from its code point. */
const TAB = String.fromCharCode(9)
/** Backslash character, built from its code point. */
const BACKSLASH = String.fromCharCode(92)
/** Wraps `text` in an inline code span delimited by `delimiter`. */
const inlineCode = (text: string, delimiter = '`'): string => delimiter + text + delimiter

describe('findMentionTokens', () => {
  it('parses ids that are not hex (e.g. seeded ent-N ids)', () => {
    expect(findMentionTokens(token('ent-2', 'Alice'))[0].entityId).toBe('ent-2')
  })

  it('returns an empty list for token-free content', () => {
    expect(findMentionTokens('plain text with no tokens')).toEqual([])
  })

  it('ignores tokens inside a fenced code block', () => {
    const content = ['Before', '```md', token('e1', 'Alice'), '```', 'After', token('e2', 'Bob')].join(NEWLINE)
    expect(findMentionTokens(content).map((t) => t.entityId)).toEqual(['e2'])
  })

  it('ignores tokens in tilde fences and unclosed fences', () => {
    expect(findMentionTokens(['~~~', token('e1', 'Alice'), '~~~'].join(NEWLINE))).toEqual([])
    expect(findMentionTokens(['```', token('e1', 'Alice')].join(NEWLINE))).toEqual([])
  })

  it('ignores tokens inside inline code spans', () => {
    const content = `Use ${inlineCode(token('e1', 'Alice'))} but ${token('e2', 'Bob')} links`
    expect(findMentionTokens(content).map((t) => t.entityId)).toEqual(['e2'])
  })

  it('handles multi-backtick inline spans', () => {
    const content = `${inlineCode(token('e1', 'Alice'), '``')} and ${token('e2', 'Bob')}`
    expect(findMentionTokens(content).map((t) => t.entityId)).toEqual(['e2'])
  })

  it('keeps scanning after an unmatched multi-backtick run', () => {
    // The leading two-backtick run has no matching delimiter, so it is literal
    // text and the later single-backtick span still hides its token.
    const content = '``literal and ' + inlineCode(token('e1', 'Alice'))
    expect(findMentionTokens(content)).toEqual([])
  })

  it('ignores tokens in indented code blocks', () => {
    const content = [`    ${token('e1', 'Alice')}`, '', token('e2', 'Bob')].join(NEWLINE)
    expect(findMentionTokens(content).map((t) => t.entityId)).toEqual(['e2'])
  })

  it('ignores tokens in tab-indented code blocks', () => {
    const content = [TAB + token('e1', 'Alice'), '', token('e2', 'Bob')].join(NEWLINE)
    expect(findMentionTokens(content).map((t) => t.entityId)).toEqual(['e2'])
  })

  it('ignores tokens in code blocks inside block quotes', () => {
    const indented = ['>     ' + token('e1', 'Alice'), '', token('e2', 'Bob')].join(NEWLINE)
    expect(findMentionTokens(indented).map((t) => t.entityId)).toEqual(['e2'])

    const fenced = ['> ```md', '> ' + token('e1', 'Alice'), '> ```'].join(NEWLINE)
    expect(findMentionTokens(fenced)).toEqual([])
  })

  it('ignores tokens in code blocks indented after a list marker', () => {
    const content = ['-     ' + token('e1', 'Alice'), '', token('e2', 'Bob')].join(NEWLINE)
    expect(findMentionTokens(content).map((t) => t.entityId)).toEqual(['e2'])
  })

  it('treats an escaped backtick as literal text, not a span delimiter', () => {
    // The opening backtick is escaped and the trailing one is unmatched, so the
    // renderer shows the token as a link.
    const content = BACKSLASH + '`' + token('e1', 'Alice') + '`'
    expect(findMentionTokens(content).map((t) => t.entityId)).toEqual(['e1'])
  })

  it('does not treat a backtick fence with backticks in its info string as code', () => {
    const content = ['```js `not-a-fence`', token('e1', 'Alice')].join(NEWLINE)
    expect(findMentionTokens(content).map((t) => t.entityId)).toEqual(['e1'])
  })

  it('ignores escaped tokens but keeps tokens after a literal backslash', () => {
    expect(findMentionTokens(BACKSLASH + token('e1', 'Alice'))).toEqual([])
    expect(
      findMentionTokens(BACKSLASH + BACKSLASH + token('e1', 'Alice')).map((t) => t.entityId),
    ).toEqual(['e1'])
  })
})

describe('getMentionTrigger', () => {
  it('is inactive without an @', () => {
    expect(getMentionTrigger('hello world', 11)).toMatchObject({ active: false })
  })

  it('is inactive at caret 0', () => {
    expect(getMentionTrigger('@foo', 0)).toMatchObject({ active: false })
  })

  it('activates on a bare @ with an empty query', () => {
    const trigger = getMentionTrigger('Hello @', 7)
    expect(trigger).toMatchObject({ active: true, start: 6, query: '' })
  })

  it('grows the query as the user types the name', () => {
    const trigger = getMentionTrigger('Hello @Al', 9)
    expect(trigger).toMatchObject({ active: true, start: 6, query: 'Al' })
  })

  it('deactivates when whitespace follows the @', () => {
    expect(getMentionTrigger('Hello @foo bar', 12).active).toBe(false)
  })

  it('deactivates when the query contains a closing bracket', () => {
    expect(getMentionTrigger('[@foo]', 6).active).toBe(false)
  })

  it('deactivates when the caret is inside an existing token', () => {
    const content = `See ${token('e1', 'Alice')}`
    const inside = content.indexOf('Alice') + 2
    expect(getMentionTrigger(content, inside).active).toBe(false)
  })

  it('ignores the token-internal @ and starts a fresh trigger after a token', () => {
    const content = `See ${token('e1', 'Alice')} and @Bo`
    const caret = content.length
    const trigger = getMentionTrigger(content, caret)
    expect(trigger).toMatchObject({ active: true, start: content.indexOf('@Bo'), query: 'Bo' })
  })

  it('finds an @ mid-word', () => {
    expect(getMentionTrigger('hello@wor', 9)).toMatchObject({ active: true, start: 5, query: 'wor' })
  })

  it('stays inactive inside a fenced code block', () => {
    const content = ['```', '@Ali'].join(NEWLINE)
    expect(getMentionTrigger(content, content.length)).toMatchObject({ active: false })
  })

  it('stays inactive inside an inline code span', () => {
    expect(getMentionTrigger('`@Ali`', 4)).toMatchObject({ active: false })
  })

  it('activates right after a closed inline code span', () => {
    const content = '`code` @Ali'
    expect(getMentionTrigger(content, content.length)).toMatchObject({ active: true, query: 'Ali' })
  })

  it('activates when the caret sits just after a closed inline code span', () => {
    // The preceding character is the span's closing delimiter, but the caret
    // itself is outside the span, so typing there continues in prose.
    const content = '@Bo' + inlineCode('x')
    expect(getMentionTrigger(content, content.length)).toMatchObject({ active: true })
  })

  it('stays inactive at the end of an unclosed fence', () => {
    const content = ['```', '@Ali'].join(NEWLINE)
    expect(getMentionTrigger(content, content.length)).toMatchObject({ active: false })
  })
})

describe('buildMentionToken', () => {
  it('builds the canonical markdown link', () => {
    expect(buildMentionToken('e1', 'Alice')).toBe('[@Alice](dks://entity/e1)')
  })

  it('strips square brackets from names so the token stays well-formed', () => {
    expect(buildMentionToken('e1', 'A[B]C')).toBe('[@ABC](dks://entity/e1)')
  })

  it('percent-encodes reserved chars in entity ids so the token stays well-formed', () => {
    const token = buildMentionToken('a)b', 'Weird')
    expect(token).toBe('[@Weird](dks://entity/a%29b)')
    expect(findMentionTokens(token)[0]?.entityId).toBe('a)b')
  })
})

describe('insertMentionToken', () => {
  it('replaces the trigger span with the token', () => {
    const content = 'Hello @Al'
    const trigger = getMentionTrigger(content, content.length)
    const result = insertMentionToken(content, trigger, { id: 'e1', name: 'Alice' })
    expect(result.text).toBe(`Hello ${token('e1', 'Alice')}`)
    expect(result.selection).toBe(`Hello ${token('e1', 'Alice')}`.length)
  })

  it('replaces a bare @ (empty query)', () => {
    const content = 'Hello @'
    const trigger = getMentionTrigger(content, content.length)
    const result = insertMentionToken(content, trigger, { id: 'e1', name: 'Alice' })
    expect(result.text).toBe(`Hello ${token('e1', 'Alice')}`)
  })

  it('preserves surrounding text', () => {
    const content = 'a @bc d'
    const trigger = getMentionTrigger(content, 5)
    const result = insertMentionToken(content, trigger, { id: 'e1', name: 'Bobby' })
    expect(result.text).toBe(`a ${token('e1', 'Bobby')} d`)
  })

  it('is a no-op for an inactive trigger', () => {
    const content = 'plain'
    const result = insertMentionToken(content, getMentionTrigger(content, 5), { id: 'e1', name: 'A' })
    expect(result).toEqual({ text: content, selection: -1 })
  })
})

describe('insert/remove round-trip', () => {
  it('inserting then removing a token restores the original text', () => {
    const content = 'See @Alice for details.'
        const trigger = getMentionTrigger(content, 10)
    const inserted = insertMentionToken(content, trigger, { id: 'e1', name: 'Alice' })
    expect(removeMentionTokens(inserted.text)).toBe('See  for details.')
  })

  it('removes only tokens for the requested entity', () => {
    const content = `${token('e1', 'Alice')} and ${token('e2', 'Bob')}`
    expect(removeMentionTokens(content, 'e2')).toBe(`${token('e1', 'Alice')} and `)
  })

  it('removes adjacent tokens regardless of order', () => {
    const content = `${token('e1', 'A')}${token('e2', 'B')}`
    expect(removeMentionTokens(content)).toBe('')
  })
})

describe('extractMentionLinks', () => {
  const entities = [
    makeEntity({ id: 'e1', name: 'Alice' }),
    makeEntity({ id: 'e2', name: 'Bob' }),
  ]

  it('derives mention links resolved against live entities', () => {
    const content = `${token('e1', 'Alice')} ${token('e2', 'Bob')}`
    const { mentionLinks } = extractMentionLinks(content, entities)
    expect(mentionLinks).toEqual([
      { targetId: 'e1', relation: MENTION_LINK_RELATION },
      { targetId: 'e2', relation: MENTION_LINK_RELATION },
    ])
  })

  it('skips unresolved (deleted/stale) ids', () => {
    const content = `${token('e1', 'Alice')} ${token('ghost', 'Ghost')}`
    const { mentionLinks } = extractMentionLinks(content, entities)
    expect(mentionLinks).toEqual([{ targetId: 'e1', relation: MENTION_LINK_RELATION }])
  })

  it('skips the excluded self id (self-mentions do not create links)', () => {
    const content = `${token('e1', 'Alice')} ${token('e2', 'Bob')}`
    const { mentionLinks } = extractMentionLinks(content, entities, 'e1')
    expect(mentionLinks).toEqual([{ targetId: 'e2', relation: MENTION_LINK_RELATION }])
  })

  it('dedupes repeated mentions of the same entity', () => {
    const content = `${token('e1', 'Alice')} ${token('e1', 'Alice')}`
    const { mentionLinks, mentions } = extractMentionLinks(content, entities)
    expect(mentionLinks).toHaveLength(1)
    expect(mentions).toEqual([{ entityId: 'e1', name: 'Alice' }])
  })

  it('ignores mention syntax shown inside code spans and fences', () => {
    const content = [
      'Documenting the syntax:',
      '```md',
      token('e1', 'Alice'),
      '```',
      'Inline: ' + inlineCode(token('e1', 'Alice')),
      `Real link: ${token('e2', 'Bob')}`,
    ].join(NEWLINE)
    const { mentionLinks } = extractMentionLinks(content, entities)
    expect(mentionLinks).toEqual([{ targetId: 'e2', relation: MENTION_LINK_RELATION }])
  })
})

describe('mergeMentionLinks', () => {
  it('keeps existing links and appends only missing pairs', () => {
    const existing = [{ targetId: 'e9', relation: 'related' }]
    const derived = [
      { targetId: 'e9', relation: 'related' },
      { targetId: 'e1', relation: MENTION_LINK_RELATION },
    ]
    expect(mergeMentionLinks(existing, derived)).toEqual([
      { targetId: 'e9', relation: 'related' },
      { targetId: 'e1', relation: MENTION_LINK_RELATION },
    ])
  })

  it('does not mutate the existing array', () => {
    const existing = [{ targetId: 'e9', relation: 'related' }]
    mergeMentionLinks(existing, [{ targetId: 'e1', relation: MENTION_LINK_RELATION }])
    expect(existing).toEqual([{ targetId: 'e9', relation: 'related' }])
  })

  it('drops stale mention links whose token left the content', () => {
    const existing = [
      { targetId: 'e1', relation: MENTION_LINK_RELATION },
      { targetId: 'e9', relation: 'related' },
    ]
    // e1 no longer appears in the content; e9 is a manual relation.
    expect(mergeMentionLinks(existing, [])).toEqual([{ targetId: 'e9', relation: 'related' }])
  })
})

describe('applyMentionBacklinks', () => {
  const base = makeEntity({ id: 'src', name: 'Source' })
  const alice = makeEntity({ id: 'a', name: 'Alice' })
  const bob = makeEntity({ id: 'b', name: 'Bob' })

  it('adds reciprocal backlinks for mentioned entities only', () => {
    const changed = applyMentionBacklinks([base, alice, bob], 'src', new Set(['a']))
    expect(changed).toHaveLength(1)
    expect(changed[0].id).toBe('a')
    expect(changed[0].links).toContainEqual({ targetId: 'src', relation: MENTIONED_IN_RELATION })
    expect(changed[0].updatedAt).not.toBe(alice.updatedAt)
  })

  it('never backlinks the source entity itself', () => {
    const selfLinked = makeEntity({ id: 'src', name: 'Source', links: [{ targetId: 'x', relation: 'y' }] })
    const changed = applyMentionBacklinks([selfLinked], 'src', new Set(['src']))
    expect(changed).toEqual([])
  })

  it('revokes backlinks for no-longer-mentioned entities', () => {
    const stale = makeEntity({
      id: 'a',
      name: 'Alice',
      links: [{ targetId: 'src', relation: MENTIONED_IN_RELATION }],
    })
    const changed = applyMentionBacklinks([base, stale], 'src', new Set())
    expect(changed).toHaveLength(1)
    expect(changed[0].id).toBe('a')
    expect(changed[0].links).toEqual([])
  })

  it('leaves unchanged entities untouched', () => {
    const changed = applyMentionBacklinks([base, alice, bob], 'src', new Set([]))
    expect(changed).toEqual([])
  })

  it('handles add and revoke in a single pass', () => {
    const stale = makeEntity({
      id: 'b',
      name: 'Bob',
      links: [{ targetId: 'src', relation: MENTIONED_IN_RELATION }],
    })
    const changed = applyMentionBacklinks([base, alice, stale], 'src', new Set(['a']))
    const byId = new Map(changed.map((e) => [e.id, e]))
    expect(byId.get('a')?.links).toContainEqual({ targetId: 'src', relation: MENTIONED_IN_RELATION })
    expect(byId.get('b')?.links).toEqual([])
  })
})