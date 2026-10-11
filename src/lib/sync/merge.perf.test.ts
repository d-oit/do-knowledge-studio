import { describe, it, expect } from 'vitest'
import { mergeEntities, mergeClaims } from './merge'
import type { Entity, Claim } from '@/lib/studio/types'

function generateEntities(count: number): { local: Entity[]; remote: Entity[] } {
  const local: Entity[] = []
  const remote: Entity[] = []

  for (let i = 0; i < count; i++) {
    const id = `entity-${i}`
    const timestamp = new Date(1700000000000 + i * 1000).toISOString()
    const remoteTimestamp = new Date(1700000000000 + i * 1000 + 500).toISOString()

    const links = [
      { targetId: `entity-${(i + 1) % count}`, relation: 'relates_to' },
      { targetId: `entity-${(i + 2) % count}`, relation: 'depends_on' },
    ]

    local.push({
      id,
      name: `Entity ${i}`,
      type: 'concept',
      description: `Description ${i}`,
      content: `Content for entity ${i}`,
      sourceUrl: `https://example.com/${i}`,
      tags: ['tag1', 'tag2', `tag-${i}`],
      createdAt: timestamp,
      updatedAt: timestamp,
      links,
    })

    remote.push({
      id,
      name: `Entity Remote ${i}`,
      type: 'concept',
      description: `Description ${i}`,
      content: `Content for entity ${i}`,
      sourceUrl: `https://example.com/${i}`,
      tags: ['tag1', 'tag2', `tag-remote-${i}`],
      createdAt: timestamp,
      updatedAt: remoteTimestamp,
      links: [
        ...links,
        { targetId: `entity-${(i + 3) % count}`, relation: 'mentions' },
      ],
    })
  }

  return { local, remote }
}

function generateClaims(count: number): { local: Claim[]; remote: Claim[] } {
  const local: Claim[] = []
  const remote: Claim[] = []

  for (let i = 0; i < count; i++) {
    const id = `claim-${i}`
    const timestamp = new Date(1700000000000 + i * 1000).toISOString()
    const remoteTimestamp = new Date(1700000000000 + i * 1000 + 500).toISOString()

    local.push({
      id,
      entityId: `entity-${i % 100}`,
      statement: `Statement ${i}`,
      evidence: `Evidence ${i}`,
      confidence: 0.8,
      verification: 'verified',
      source: `Source ${i}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      editHistory: [
        { statement: `Initial statement ${i}`, editedAt: timestamp },
      ],
    })

    remote.push({
      id,
      entityId: `entity-${i % 100}`,
      statement: `Remote Statement ${i}`,
      evidence: `Evidence ${i}`,
      confidence: 0.85,
      verification: 'verified',
      source: `Source ${i}`,
      createdAt: timestamp,
      updatedAt: remoteTimestamp,
      version: 2,
      editHistory: [
        { statement: `Initial statement ${i}`, editedAt: timestamp },
        { statement: `Remote Statement ${i}`, editedAt: remoteTimestamp },
      ],
    })
  }

  return { local, remote }
}

describe('merge performance', () => {
  it('merges 1000 entities fast', () => {
    const { local, remote } = generateEntities(1000)
    const start = performance.now()
    const result = mergeEntities(local, remote)
    const duration = performance.now() - start

    console.error(`mergeEntities (1000 entities): ${duration.toFixed(2)}ms`)
    expect(result.merged).toHaveLength(1000)
  })

  it('merges 1000 claims fast', () => {
    const { local, remote } = generateClaims(1000)
    const start = performance.now()
    const result = mergeClaims(local, remote)
    const duration = performance.now() - start

    console.error(`mergeClaims (1000 claims): ${duration.toFixed(2)}ms`)
    expect(result.merged).toHaveLength(1000)
  })
})
