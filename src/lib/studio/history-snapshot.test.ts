import { describe, it, expect } from 'vitest'
import { reconcileSnapshot, resolveDanglingId, snapshotCorpus } from './history-snapshot'
import type { Claim, Entity } from './types'

const entity = (id: string, links: Entity['links'] = []): Entity => ({
  id,
  name: `Entity ${id}`,
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links,
})

const claim = (id: string, entityId: string): Claim => ({
  id,
  entityId,
  statement: `Claim ${id}`,
  confidence: 0.5,
  verification: 'unverified',
})

describe('snapshotCorpus', () => {
  it('copies each entity so later mutation cannot reach into the snapshot', () => {
    const live = [entity('a')]
    const { entities } = snapshotCorpus(live, [])

    live[0].name = 'mutated after snapshot'
    live.push(entity('b'))

    expect(entities).toHaveLength(1)
    expect(entities[0].name).toBe('Entity a')
  })

  it('copies claims for the same reason', () => {
    const liveClaims = [claim('c1', 'a')]
    const { claims } = snapshotCorpus([entity('a')], liveClaims)

    liveClaims[0].statement = 'mutated'

    expect(claims[0].statement).toBe('Claim c1')
  })
})

describe('resolveDanglingId', () => {
  it('keeps an id that still names an entity', () => {
    expect(resolveDanglingId('a', [entity('a')])).toBe('a')
  })

  it('clears an id whose entity is gone', () => {
    expect(resolveDanglingId('gone', [entity('a')])).toBeNull()
  })

  it('leaves a null id null', () => {
    expect(resolveDanglingId(null, [entity('a')])).toBeNull()
  })
})

describe('reconcileSnapshot', () => {
  it('drops links whose target is not in the snapshot', () => {
    const snapshot = {
      entities: [entity('a', [{ targetId: 'missing', relation: 'mentions' }])],
      claims: [],
    }

    const { entities } = reconcileSnapshot(snapshot)

    expect(entities[0].links).toHaveLength(0)
  })

  it('keeps links whose target is present', () => {
    const snapshot = {
      entities: [entity('a', [{ targetId: 'b', relation: 'mentions' }]), entity('b')],
      claims: [],
    }

    expect(reconcileSnapshot(snapshot).entities[0].links).toHaveLength(1)
  })

  it('drops claims whose owning entity is not in the snapshot', () => {
    const snapshot = {
      entities: [entity('a')],
      claims: [claim('c1', 'a'), claim('c2', 'missing')],
    }

    const { claims } = reconcileSnapshot(snapshot)

    expect(claims.map((c) => c.id)).toEqual(['c1'])
  })

  it('never mutates the input snapshot', () => {
    const snapshot = {
      entities: [entity('a', [{ targetId: 'missing', relation: 'mentions' }])],
      claims: [claim('c1', 'missing')],
    }

    reconcileSnapshot(snapshot)

    expect(snapshot.entities[0].links).toHaveLength(1)
    expect(snapshot.claims).toHaveLength(1)
  })
})
