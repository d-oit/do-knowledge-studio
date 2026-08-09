import { describe, it, expect } from 'vitest'
import { buildOkfBundle, slug } from './bundle'
import type { Entity, Claim, GraphEdge } from '@/lib/studio/types'

describe('OKF Bundle Export', () => {
  const dummyEntities: Entity[] = [
    {
      id: 'entity-1',
      name: 'Google Cloud Platform',
      type: 'concept',
      description: 'A suite of cloud computing services.',
      content: 'Google Cloud Platform provides infrastructure as a service.',
      tags: ['cloud', 'google'],
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T00:00:00.000Z',
      links: [],
    },
    {
      id: 'entity-2',
      name: 'Log',
      type: 'note',
      description: 'Collision test case.',
      content: 'This entity has a reserved name.',
      tags: ['test'],
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T00:00:00.000Z',
      links: [],
    },
  ]

  const dummyClaims: Claim[] = [
    {
      id: 'claim-1',
      entityId: 'entity-1',
      statement: 'OKF v0.2 was released in July 2026.',
      confidence: 0.9,
      verification: 'verified',
      source: 'https://github.com/GoogleCloudPlatform/knowledge-catalog',
      evidence: 'Announcement blog post',
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T00:00:00.000Z',
    },
  ]

  const dummyEdges: GraphEdge[] = [
    {
      id: 'edge-1',
      source: 'entity-1',
      target: 'entity-2',
      relation: 'collides-with',
    },
  ]

  it('correctly maps entities to concept files and includes reserved index and log', () => {
    const bundle = buildOkfBundle(dummyEntities, dummyClaims, dummyEdges, '0.1.0', new Date('2026-07-24'))

    expect(bundle.okfVersion).toBe('0.2')
    expect(bundle.files.length).toBe(4) // index.md, log.md, concepts/google-cloud-platform.md, notes/log-concept.md

    const indexFile = bundle.files.find((f) => f.path === 'index.md')
    expect(indexFile).toBeDefined()
    expect(indexFile?.content).toContain('okf_version: "0.2"')

    const logFile = bundle.files.find((f) => f.path === 'log.md')
    expect(logFile).toBeDefined()
    expect(logFile?.content).toContain('## 2026-07-24')

    const conceptFile = bundle.files.find((f) => f.path === 'concepts/google-cloud-platform.md')
    expect(conceptFile).toBeDefined()
    expect(conceptFile?.content).toContain('type: Concept')
    expect(conceptFile?.content).toContain('title: Google Cloud Platform')
    expect(conceptFile?.content).toContain('tags:\n  - cloud\n  - google')
    expect(conceptFile?.content).not.toContain('stale_after:') // optional, not set

    // Colliding slug concept check
    const logConceptFile = bundle.files.find((f) => f.path === 'notes/log-concept.md')
    expect(logConceptFile).toBeDefined()
  })

  it('correctly maps footnotes and keeps them stable', () => {
    const bundle = buildOkfBundle(dummyEntities, dummyClaims, dummyEdges, '0.1.0', new Date('2026-07-24'))
    const conceptFile = bundle.files.find((f) => f.path === 'concepts/google-cloud-platform.md')

    expect(conceptFile?.content).toContain('[^src-1]')
    expect(conceptFile?.content).toContain('[^src-1]: Announcement blog post')
  })

  it('converts graph edges to related links in Markdown', () => {
    const bundle = buildOkfBundle(dummyEntities, dummyClaims, dummyEdges, '0.1.0', new Date('2026-07-24'))
    const conceptFile = bundle.files.find((f) => f.path === 'concepts/google-cloud-platform.md')

    expect(conceptFile?.content).toContain('# Related')
    expect(conceptFile?.content).toContain('* [Log](/notes/log-concept.md)')
  })

  it('correctly slugs names safely', () => {
    expect(slug('Hello World! 123')).toBe('hello-world-123')
    expect(slug('---hello---world---')).toBe('hello-world')
    expect(slug('')).toBe('untitled')
  })
})
