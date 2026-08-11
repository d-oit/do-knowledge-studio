import { describe, it, expect } from 'vitest'
import { buildOkfBundle, slug } from './bundle'
import type { Entity, Claim, GraphEdge } from '@/lib/studio/types'

describe('OKF Bundle Export', () => {
  /** The dummy entities. */
  const dummyEntities: Entity[] = [
    {
      /** Unique identifier. */
      id: 'entity-1',
      /** Human-readable name. */
      name: 'Google Cloud Platform',
      /** Entity type. */
      type: 'concept',
      /** One-line summary of the item. */
      description: 'A suite of cloud computing services.',
      /** Markdown or text content. */
      content: 'Google Cloud Platform provides infrastructure as a service.',
      /** Optional tags payload carried through the operation. */
      tags: ['cloud', 'google'],
      /** ISO timestamp of claim creation. */
      createdAt: '2026-07-24T00:00:00.000Z',
      /** ISO timestamp of the last claim update. */
      updatedAt: '2026-07-24T00:00:00.000Z',
      /** Related entity links. */
      links: [],
    },
    {
      /** Unique identifier. */
      id: 'entity-2',
      /** Human-readable name. */
      name: 'Log',
      /** Entity type. */
      type: 'note',
      /** One-line summary of the item. */
      description: 'Collision test case.',
      /** Markdown or text content. */
      content: 'This entity has a reserved name.',
      /** Optional tags payload carried through the operation. */
      tags: ['test'],
      /** ISO timestamp of claim creation. */
      createdAt: '2026-07-24T00:00:00.000Z',
      /** ISO timestamp of the last claim update. */
      updatedAt: '2026-07-24T00:00:00.000Z',
      /** Related entity links. */
      links: [],
    },
  ]

  /** The dummy claims. */
  const dummyClaims: Claim[] = [
    {
      /** Unique identifier. */
      id: 'claim-1',
      /** Owning entity id. */
      entityId: 'entity-1',
      /** The claim statement text. */
      statement: 'OKF v0.2 was released in July 2026.',
      /** Claim confidence score. */
      confidence: 0.9,
      /** Claim verification status. */
      verification: 'verified',
      /** Source resource for the claim. */
      source: 'https://github.com/GoogleCloudPlatform/knowledge-catalog',
      /** Supporting evidence for the claim. */
      evidence: 'Announcement blog post',
      /** ISO timestamp of claim creation. */
      createdAt: '2026-07-24T00:00:00.000Z',
      /** ISO timestamp of the last claim update. */
      updatedAt: '2026-07-24T00:00:00.000Z',
    },
  ]

  /** The dummy edges. */
  const dummyEdges: GraphEdge[] = [
    {
      /** Unique identifier. */
      id: 'edge-1',
      /** Source resource for the claim. */
      source: 'entity-1',
      /** The target. */
      target: 'entity-2',
      /** The relation. */
      relation: 'collides-with',
    },
  ]

  it('correctly maps entities to concept files and includes reserved index and log', () => {
    /** The bundle. */
    const bundle = buildOkfBundle(dummyEntities, dummyClaims, dummyEdges, '0.1.0', new Date('2026-07-24'))

    expect(bundle.okfVersion).toBe('0.2')
    expect(bundle.files.length).toBe(4) // index.md, log.md, concepts/google-cloud-platform.md, notes/log-concept.md

    /** The index file. */
    const indexFile = bundle.files.find((f) => f.path === 'index.md')
    expect(indexFile).toBeDefined()
    expect(indexFile?.content).toContain('okf_version: "0.2"')

    /** The log file. */
    const logFile = bundle.files.find((f) => f.path === 'log.md')
    expect(logFile).toBeDefined()
    expect(logFile?.content).toContain('## 2026-07-24')

    /** The concept file. */
    const conceptFile = bundle.files.find((f) => f.path === 'concepts/google-cloud-platform.md')
    expect(conceptFile).toBeDefined()
    expect(conceptFile?.content).toContain('type: Concept')
    expect(conceptFile?.content).toContain('title: Google Cloud Platform')
    expect(conceptFile?.content).toContain('tags:\n  - cloud\n  - google')
    expect(conceptFile?.content).not.toContain('stale_after:') // optional, not set

    // Colliding slug concept check
    /** The log concept file. */
    const logConceptFile = bundle.files.find((f) => f.path === 'notes/log-concept.md')
    expect(logConceptFile).toBeDefined()
  })

  it('correctly maps footnotes and keeps them stable', () => {
    /** The bundle. */
    const bundle = buildOkfBundle(dummyEntities, dummyClaims, dummyEdges, '0.1.0', new Date('2026-07-24'))
    /** The concept file. */
    const conceptFile = bundle.files.find((f) => f.path === 'concepts/google-cloud-platform.md')

    expect(conceptFile?.content).toContain('[^src-1]')
    expect(conceptFile?.content).toContain('[^src-1]: Announcement blog post')
  })

  it('converts graph edges to related links in Markdown', () => {
    /** The bundle. */
    const bundle = buildOkfBundle(dummyEntities, dummyClaims, dummyEdges, '0.1.0', new Date('2026-07-24'))
    /** The concept file. */
    const conceptFile = bundle.files.find((f) => f.path === 'concepts/google-cloud-platform.md')

    expect(conceptFile?.content).toContain('# Related')
    expect(conceptFile?.content).toContain('* [Log](/notes/log-concept.md)')
  })

  it('correctly slugs names safely', () => {
    expect(slug('Hello World! 123')).toBe('hello-world-123')
    expect(slug('---hello---world---')).toBe('hello-world')
    expect(slug('')).toBe('untitled')
  })

  it('disambiguates slug collisions instead of overwriting concept files', () => {
    /** The colliding entities. */
    const collidingEntities: Entity[] = [
      { ...dummyEntities[0], id: 'entity-1', name: 'Foo Bar' },
      { ...dummyEntities[0], id: 'entity-2', name: 'Foo-Bar' },
    ]

    /** The bundle. */
    const bundle = buildOkfBundle(collidingEntities, [], [], '0.1.0', new Date('2026-07-24'))

    /** The concept paths. */
    const conceptPaths = bundle.files
      .map((f) => f.path)
      .filter((p) => p.startsWith('concepts/'))
      .sort()
    expect(conceptPaths).toEqual(['concepts/foo-bar-2.md', 'concepts/foo-bar.md'])
    expect(new Set(bundle.files.map((f) => f.path)).size).toBe(bundle.files.length)
  })

  it('index.md resolves titles via the path map, not slug suffix matching', () => {
    /** The colliding entities. */
    const collidingEntities: Entity[] = [
      { ...dummyEntities[0], id: 'entity-1', name: 'Foo Bar' },
      { ...dummyEntities[0], id: 'entity-2', name: 'Bar' },
    ]

    /** The bundle. */
    const bundle = buildOkfBundle(collidingEntities, [], [], '0.1.0', new Date('2026-07-24'))
    /** The index file. */
    const indexFile = bundle.files.find((f) => f.path === 'index.md')

    // The slug of "Foo Bar" ends with "bar", but the path map must still
    // attribute the concept file to "Foo Bar", not to the entity named "Bar".
    expect(indexFile?.content).toContain('* [Foo Bar](/concepts/foo-bar.md)')
    expect(indexFile?.content).toContain('* [Bar](/concepts/bar.md)')
  })
})