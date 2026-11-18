import { describe, expect, it } from 'vitest'
import { parseFrontmatter, splitFrontmatter } from './frontmatter.js'

describe('parseFrontmatter', () => {
  it('parses scalars, booleans, numbers, and null', () => {
    const r = parseFrontmatter('title: Alpha\ndescription: A project\ncount: 3\nflag: true\nnone: null\n')
    expect(r).toEqual({
      ok: true,
      data: { title: 'Alpha', description: 'A project', count: 3, flag: true, none: null },
    })
  })

  it('parses quoted strings with escapes', () => {
    const r = parseFrontmatter('title: "He said \\"hi\\""\nnote: \'it\'s fine\'\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.title).toBe('He said "hi"')
    expect(r.data.note).toBe("it's fine")
  })

  it('parses block lists and nested maps', () => {
    const text = [
      'tags:',
      '  - research',
      '  - alpha',
      'sources:',
      '  - id: src-1',
      '    resource: https://example.com',
      '    title: Paper',
      'verified:',
      '  by: human:ada',
      '  at: 2026-01-02T00:00:00.000Z',
    ].join('\n')
    const r = parseFrontmatter(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tags).toEqual(['research', 'alpha'])
    expect(r.data.sources).toEqual([{ id: 'src-1', resource: 'https://example.com', title: 'Paper' }])
    expect(r.data.verified).toEqual({ by: 'human:ada', at: '2026-01-02T00:00:00.000Z' })
  })

  it('parses inline flow arrays', () => {
    const r = parseFrontmatter('aliases: [Foo, Bar]\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.aliases).toEqual(['Foo', 'Bar'])
  })

  it('keeps URLs with fragments intact (no comment stripping inside tokens)', () => {
    const r = parseFrontmatter('resource: https://example.com/#frag\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.resource).toBe('https://example.com/#frag')
  })

  it('ignores full-line comments and trailing comments after values', () => {
    const r = parseFrontmatter('# a comment\ntitle: Alpha # trailing\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.title).toBe('Alpha')
  })

  it('rejects tabs in indentation', () => {
    const r = parseFrontmatter('tags:\n\t- a\n')
    expect(r.ok).toBe(false)
  })

  it('rejects non-mapping documents', () => {
    expect(parseFrontmatter('- a\n- b\n').ok).toBe(false)
  })

  it('rejects scalar entries in a mapping document', () => {
    expect(parseFrontmatter('[unclosed').ok).toBe(false)
  })
})

describe('splitFrontmatter', () => {
  it('splits frontmatter from body', () => {
    const { frontmatter, body } = splitFrontmatter('---\ntitle: Alpha\n---\nBody text.\n')
    expect(frontmatter).toBe('title: Alpha')
    expect(body).toBe('Body text.\n')
  })

  it('returns null frontmatter without fences', () => {
    const { frontmatter, body } = splitFrontmatter('Just body.\n')
    expect(frontmatter).toBeNull()
    expect(body).toBe('Just body.\n')
  })
})
