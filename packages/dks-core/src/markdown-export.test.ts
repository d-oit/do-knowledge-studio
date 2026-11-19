import { describe, expect, it } from 'vitest'
import { buildMarkdownExport } from './markdown-export.js'
import { parseMarkdownBundle } from './markdown.js'
import type { CoreEntity } from './types.js'

const entities: CoreEntity[] = [
  {
    id: 'notes/alpha',
    name: 'Alpha',
    type: 'concept',
    description: 'First',
    content: 'Alpha body.',
    tags: ['research'],
    aliases: ['A'],
    links: [{ targetId: 'notes/beta', relation: 'related' }],
  },
  {
    id: 'notes/beta',
    name: 'Beta',
    type: 'note',
    description: '',
    content: 'Beta body.',
    tags: [],
  },
]

describe('buildMarkdownExport', () => {
  it('serializes entities with frontmatter and wikilinks', () => {
    const files = buildMarkdownExport(entities)
    const alpha = files.find((f) => f.path === 'alpha.md')
    expect(alpha?.content).toContain('title: Alpha')
    expect(alpha?.content).toContain('type: concept')
    expect(alpha?.content).toContain('aliases:')
    expect(alpha?.content).toContain('[[Beta]]')
    expect(files.map((f) => f.path)).toEqual(['alpha.md', 'beta.md'])
  })

  it('round-trips through the markdown parser', () => {
    const files = buildMarkdownExport(entities)
    const map = new Map(files.map((f) => [f.path, f.content]))
    const r = parseMarkdownBundle(map)
    const parsedEntities = r.success ? r.entities : []
    expect(r.success).toBe(true)
    expect(parsedEntities[0]?.aliases).toEqual(['A'])
    expect(parsedEntities[0]?.tags).toEqual(['research'])
    expect(parsedEntities[0]?.links).toEqual([{ targetId: 'beta', relation: 'related' }])
  })

  it('disambiguates duplicate slugs', () => {
    const dupes: CoreEntity[] = [
      { id: 'a', name: 'Same', type: 'concept', description: '', content: '', tags: [] },
      { id: 'b', name: 'Same', type: 'concept', description: '', content: '', tags: [] },
    ]
    const paths = buildMarkdownExport(dupes).map((f) => f.path)
    expect(paths).toEqual(['same.md', 'same-2.md'])
  })
})
