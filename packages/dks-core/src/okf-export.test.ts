import { describe, expect, it } from 'vitest'
import { buildOkfBundle } from './okf-export.js'
import { parseBundleFiles } from './okf-parse.js'
import type { CoreExportClaim, CoreExportEntity } from './okf-export.js'

const entities: CoreExportEntity[] = [
  {
    id: 'concepts/alpha',
    name: 'Alpha Project',
    type: 'project',
    description: 'First project',
    content: 'Alpha body.',
    tags: ['research', 'alpha'],
  },
  {
    id: 'concepts/beta',
    name: 'Beta',
    type: 'concept',
    description: '',
    content: 'Beta body.',
    tags: [],
  },
]

const claims: CoreExportClaim[] = [
  {
    entityId: 'concepts/alpha',
    statement: 'Alpha scales linearly',
    source: 'https://example.com/alpha',
    evidence: 'Alpha paper',
  },
  {
    entityId: 'concepts/beta',
    statement: 'Beta is stable',
  },
]

describe('buildOkfBundle', () => {
  it('walks a bundle with index, log, and concept files (PWA-identical)', () => {
    const bundle = buildOkfBundle(entities, claims, [{ source: 'concepts/alpha', target: 'concepts/beta' }], '0.2.0', new Date('2026-11-17T00:00:00Z'))
    const paths = bundle.files.map((f) => f.path)
    expect(paths).toEqual(['index.md', 'log.md', 'projects/alpha-project.md', 'concepts/beta.md'])
    const alpha = bundle.files.find((f) => f.path === 'projects/alpha-project.md')
    expect(alpha?.content).toContain('type: Project')
    expect(alpha?.content).toContain('title: Alpha Project')
    expect(alpha?.content).toContain('description: First project')
    expect(alpha?.content).toContain('status: stable')
    expect(alpha?.content).toContain('generated:')
    expect(alpha?.content).toContain('do-knowledge-studio/0.2.0')
    expect(alpha?.content).toContain('sources:')
    expect(alpha?.content).toContain('- id: src-1')
    expect(alpha?.content).toContain('- Alpha scales linearly[^src-1]')
    expect(alpha?.content).toContain('[^src-1]: Alpha paper')
    expect(alpha?.content).toContain('* [Beta](/concepts/beta.md)')
    const index = bundle.files.find((f) => f.path === 'index.md')
    expect(index?.content).toContain('okf_version: "0.2"')
    expect(index?.content).toContain('# Knowledge Bundle')
    expect(index?.content).toContain('# Projects')
    expect(index?.content).toContain('* [Alpha Project](/projects/alpha-project.md) - First project')
    expect(index?.content).toContain('# Concepts')
    const log = bundle.files.find((f) => f.path === 'log.md')
    expect(log?.content).toContain('## 2026-11-17')
  })

  it('round-trips through the parser', () => {
    const bundle = buildOkfBundle(entities, claims, [{ source: 'concepts/alpha', target: 'concepts/beta' }])
    const files = new Map(bundle.files.map((f) => [f.path, f.content]))
    const loaded = parseBundleFiles(files)
    const alpha = loaded.concepts.find((c) => c.id === 'projects/alpha-project')
    expect(alpha?.name).toBe('Alpha Project')
    expect(alpha?.type).toBe('Project')
    expect(alpha?.tags).toEqual(['research', 'alpha'])
    expect(alpha?.claims).toEqual([
      { statement: 'Alpha scales linearly', verification: 'unverified', source: 'https://example.com/alpha', evidence: 'Alpha paper' },
    ])
    expect(alpha?.relatedIds).toEqual(['concepts/beta'])
    expect(alpha?.content).toBe('Alpha body.')
  })

  it('disambiguates duplicate slugs', () => {
    const dupes: CoreExportEntity[] = [
      { id: 'a', name: 'Hello World', type: 'concept', description: '', content: '', tags: [] },
      { id: 'b', name: 'Hello  World', type: 'concept', description: '', content: '', tags: [] },
    ]
    const bundle = buildOkfBundle(dupes, [])
    const paths = bundle.files.map((f) => f.path).filter((p) => p.startsWith('concepts/'))
    expect(paths).toEqual(['concepts/hello-world.md', 'concepts/hello-world-2.md'])
  })
})
