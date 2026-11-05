import { describe, expect, it } from 'vitest'
import type { Claim, Entity } from '@/lib/studio/types'
import { buildMentionToken } from '@/lib/editor/mention'
import { buildMarkdownExport } from './export-helpers'
import { isMarkdownExportFile, parseMarkdownExport } from '@/lib/import/markdown-export-parse'

/** Seed library exercising metadata, wikilinked content, and every claim shape. */
const seedEntities = (): Entity[] => [
  {
    id: 'e-atlas',
    name: 'Atlas',
    type: 'project',
    description: 'Mapping the unknown.',
    content: `Hub note referencing ${buildMentionToken('e-boreal', 'Boreal')} and a rule:\n---\nkept as prose.`,
    tags: ['maps', 'q4'],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    links: [{ targetId: 'e-boreal', relation: 'explores' }],
  },
  {
    id: 'e-boreal',
    name: 'Boreal',
    type: 'note',
    description: '',
    content: '',
    sourceUrl: 'https://example.com/boreal',
    tags: [],
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    links: [],
  },
]

const seedClaims = (): Claim[] => [
  {
    id: 'c-1',
    entityId: 'e-atlas',
    statement: 'The northern passage stays open year-round',
    confidence: 0.9,
    verification: 'verified',
    source: 'field log',
    evidence: 'three crossings in January',
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    version: 1,
    editHistory: [],
  },
  {
    id: 'c-2',
    entityId: 'e-atlas',
    statement: 'Supplies arrive weekly',
    confidence: 0.5,
    verification: 'unverified',
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    version: 1,
    editHistory: [],
  },
]

describe('Markdown export round-trip', () => {
  it('restores names, tags, descriptions, content links, and claims', () => {
    const exported = buildMarkdownExport(seedEntities(), seedClaims())
    expect(isMarkdownExportFile(exported)).toBe(true)

    const result = parseMarkdownExport(exported)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.error)

    expect(result.entities).toHaveLength(2)
    const atlas = result.entities.find((e) => e.name === 'Atlas')
    const boreal = result.entities.find((e) => e.name === 'Boreal')
    expect(atlas?.type).toBe('project')
    expect(atlas?.tags).toEqual(['maps', 'q4'])
    expect(atlas?.description).toBe('Mapping the unknown.')
    expect(atlas?.createdAt).toBe('2026-08-01T00:00:00.000Z')
    // The `---` rule inside prose survives instead of splitting the section.
    expect(atlas?.content).toContain('---\nkept as prose.')
    // The [[Boreal]] reference re-resolves against the re-imported id.
    expect(atlas?.content).toContain(`dks://entity/${boreal?.id}`)
    expect(atlas?.content).not.toContain('[[')
    expect(boreal?.content).toBe('')

    expect(result.claims).toHaveLength(2)
    const passage = result.claims.find((c) => c.statement.includes('northern passage'))
    expect(passage).toMatchObject({
      confidence: 0.9,
      verification: 'verified',
      source: 'field log',
      evidence: 'three crossings in January',
      entityId: atlas?.id,
    })
    expect(result.claims.find((c) => c.statement.includes('Supplies'))).toMatchObject({
      confidence: 0.5,
      verification: 'unverified',
    })
  })

  it('rejects non-export Markdown and exports without sections', () => {
    expect(parseMarkdownExport('# Just a note\n').success).toBe(false)
    expect(parseMarkdownExport('# DO Knowledge Studio — export\nno sections here\n').success).toBe(false)
  })

  it('warns on unparseable claim lines instead of failing', () => {
    const exported = buildMarkdownExport(seedEntities(), seedClaims()).replace(
      '- [verified] The northern passage',
      '- [bogus] The northern passage',
    )
    const result = parseMarkdownExport(exported)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.error)
    expect(result.claims).toHaveLength(1)
    expect(result.warnings.some((w) => w.includes('unparseable claim'))).toBe(true)
  })
})
