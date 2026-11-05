import { describe, it, expect } from 'vitest'
import type { Entity } from '@/lib/studio/types'
import { buildMentionToken, extractMentionLinks, findMentionTokens } from './mention'
import {
  convertWikilinksToTokens,
  findUnlinkedMentions,
  findWikilinkTokens,
  linkFirstUnlinkedOccurrence,
  renderTokensAsWikilinks,
  resolveWikilinkTarget,
  updateMentionDisplayNames,
} from './wikilinks'

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

const NEWLINE = String.fromCharCode(10)

const ENTITIES: Entity[] = [
  makeEntity({ id: 'e-alpha', name: 'Alpha Note', tags: ['alpha-alias'] }),
  makeEntity({ id: 'e-beta', name: 'Beta Note', content: 'references Alpha Note here' }),
]

describe('findWikilinkTokens', () => {
  it('parses [[Name]] and [[Name|display]] in source order', () => {
    const tokens = findWikilinkTokens('See [[Alpha Note]] and [[Beta Note|the beta]].')
    expect(tokens.map((t) => [t.name, t.display])).toEqual([
      ['Alpha Note', null],
      ['Beta Note', 'the beta'],
    ])
  })

  it('skips wikilinks inside code', () => {
    expect(findWikilinkTokens(`\`\`\`${NEWLINE}[[Alpha Note]]${NEWLINE}\`\`\``)).toEqual([])
    expect(findWikilinkTokens('`[[Alpha Note]]`')).toEqual([])
  })

  it('skips empty names', () => {
    expect(findWikilinkTokens('See [[  ]] today')).toEqual([])
  })
})

describe('resolveWikilinkTarget', () => {
  it('prefers exact name over tag and matches case-insensitively', () => {
    expect(resolveWikilinkTarget('alpha note', ENTITIES)).toBe('e-alpha')
    expect(resolveWikilinkTarget('ALPHA-ALIAS', ENTITIES)).toBe('e-alpha')
    expect(resolveWikilinkTarget('No Such Thing', ENTITIES)).toBeUndefined()
  })

  it('resolves a tag that collides with nothing', () => {
    expect(resolveWikilinkTarget('beta note', ENTITIES, 'e-beta')).toBeUndefined()
  })
})

describe('convertWikilinksToTokens', () => {
  it('converts resolvable wikilinks and reports unresolved names', () => {
    const { text, convertedIds, unresolved } = convertWikilinksToTokens(
      'See [[Alpha Note]] and [[Ghost]] and [[Beta Note|custom]].',
      ENTITIES,
    )
    expect(text).toBe(
      `See ${buildMentionToken('e-alpha', 'Alpha Note')} and [[Ghost]] and ${buildMentionToken('e-beta', 'custom')}.`,
    )
    expect(convertedIds).toEqual(['e-alpha', 'e-beta'])
    expect(unresolved).toEqual(['Ghost'])
  })

  it('converted content derives mention links at save time', () => {
    const { text } = convertWikilinksToTokens('Link [[Alpha Note]] here.', ENTITIES, 'e-beta')
    const { mentionLinks } = extractMentionLinks(text, ENTITIES, 'e-beta')
    expect(mentionLinks).toEqual([{ targetId: 'e-alpha', relation: 'mentions' }])
  })

  it('leaves content without wikilinks untouched', () => {
    const { text, convertedIds, unresolved } = convertWikilinksToTokens('plain text', ENTITIES)
    expect(text).toBe('plain text')
    expect(convertedIds).toEqual([])
    expect(unresolved).toEqual([])
  })
})

describe('renderTokensAsWikilinks', () => {
  it('round-trips tokens to [[Name]] with live names', () => {
    const content = `See ${buildMentionToken('e-alpha', 'Old Label')} today.`
    expect(renderTokensAsWikilinks(content, ENTITIES)).toBe('See [[Alpha Note]] today.')
  })

  it('round-trips a conversion back to the original wikilink', () => {
    const { text } = convertWikilinksToTokens('See [[Alpha Note]] today.', ENTITIES)
    expect(renderTokensAsWikilinks(text, ENTITIES)).toBe('See [[Alpha Note]] today.')
  })
})

describe('updateMentionDisplayNames', () => {
  it('rewrites only tokens still showing the old name', () => {
    const content = `${buildMentionToken('e-alpha', 'Alpha Note')} and ${buildMentionToken('e-alpha', 'custom')} and ${buildMentionToken('e-beta', 'Alpha Note')}`
    expect(updateMentionDisplayNames(content, 'e-alpha', 'Alpha Note', 'Alpha Renamed')).toBe(
      `${buildMentionToken('e-alpha', 'Alpha Renamed')} and ${buildMentionToken('e-alpha', 'custom')} and ${buildMentionToken('e-beta', 'Alpha Note')}`,
    )
  })

  it('keeps links working: tokens stay id-based after a rename', () => {
    const content = `See ${buildMentionToken('e-alpha', 'Alpha Note')}.`
    const renamed = updateMentionDisplayNames(content, 'e-alpha', 'Alpha Note', 'Alpha Renamed')
    const { mentions } = extractMentionLinks(renamed, ENTITIES)
    expect(mentions).toEqual([{ entityId: 'e-alpha', name: 'Alpha Note' }])
    expect(findMentionTokens(renamed).map((t) => t.entityId)).toEqual(['e-alpha'])
  })
})

describe('findUnlinkedMentions', () => {
  it('finds prose mentions without links and skips linked/code sources', () => {
    const entities: Entity[] = [
      makeEntity({ id: 'e-target', name: 'Target Note', content: 'root' }),
      makeEntity({ id: 'e-plain', name: 'Plain', content: 'I mention Target Note here' }),
      makeEntity({
        id: 'e-linked',
        name: 'Linked',
        content: `See ${buildMentionToken('e-target', 'Target Note')}`,
      }),
      makeEntity({ id: 'e-code', name: 'Code', content: '`Target Note` in code' }),
    ]
    const found = findUnlinkedMentions(entities, 'e-target')
    expect(found.map((f) => f.sourceId)).toEqual(['e-plain'])
    expect(found[0]?.snippet).toContain('Target Note')
  })

  it('matches tags as aliases', () => {
    const entities: Entity[] = [
      makeEntity({ id: 'e-target', name: 'Target Note', tags: ['tgt'], content: '' }),
      makeEntity({ id: 'e-plain', name: 'Plain', content: 'about tgt today' }),
    ]
    expect(findUnlinkedMentions(entities, 'e-target').map((f) => f.sourceId)).toEqual(['e-plain'])
  })

  it('ignores very short names as noise', () => {
    const entities: Entity[] = [
      makeEntity({ id: 'e-target', name: 'AI', content: '' }),
      makeEntity({ id: 'e-plain', name: 'Plain', content: 'said ai loudly' }),
    ]
    expect(findUnlinkedMentions(entities, 'e-target')).toEqual([])
  })

  it('scans a 2k-note corpus without main-thread jank', () => {
    const entities: Entity[] = [makeEntity({ id: 'e-target', name: 'Target Concept Atlas', content: '' })]
    for (let i = 0; i < 2000; i += 1) {
      entities.push(
        makeEntity({
          id: `e-${i}`,
          name: `Note ${i}`,
          content: i % 10 === 0 ? `filler text mentioning Target Concept Atlas inline ${i}` : `unrelated filler ${i}`,
        }),
      )
    }
    const started = performance.now()
    const found = findUnlinkedMentions(entities, 'e-target')
    const elapsed = performance.now() - started
    expect(found.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(1000)
  })
})

describe('linkFirstUnlinkedOccurrence', () => {
  it('links the first plain occurrence and returns null when already linked', () => {
    const target = makeEntity({ id: 'e-target', name: 'Target Note' })
    const linked = linkFirstUnlinkedOccurrence('I mention Target Note here', target)
    expect(linked).toBe(`I mention ${buildMentionToken('e-target', 'Target Note')} here`)
    expect(linkFirstUnlinkedOccurrence(linked ?? '', target)).toBeNull()
  })

  it('ignores code occurrences', () => {
    const target = makeEntity({ id: 'e-target', name: 'Target Note' })
    expect(linkFirstUnlinkedOccurrence('`Target Note` only', target)).toBeNull()
  })
})
