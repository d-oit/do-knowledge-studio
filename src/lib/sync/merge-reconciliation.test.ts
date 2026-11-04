import { afterEach, describe, expect, it } from 'vitest'
import type { Claim, Entity } from '@/lib/studio/types'
import { clockFromRecord } from './causality'
import { destroy, getDoc, getSyncDoc } from './doc'
import { reconcileMergedRecords } from './merge-reconciliation'
import { addTombstone } from './tombstones'
import { destroyBridge, setYjsClaim, setYjsEntity } from './bridge'

const makeEntity = (id: string): Entity => ({
  id,
  name: 'Shared record',
  type: 'concept',
  description: 'Shared record for reconciliation coverage',
  content: 'Entity content',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

const makeClaim = (id: string, statement: string): Claim => ({
  id,
  entityId: 'parent',
  statement,
  confidence: 0.8,
  verification: 'unverified',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  editHistory: [],
})

afterEach(() => {
  destroyBridge()
  destroy()
})

describe('merged record reconciliation', () => {
  it('uses claim-scoped deletion clocks when entity and claim IDs collide', () => {
    const id = 'shared-record-id'
    const existingClaim = makeClaim(id, 'Existing claim')
    setYjsEntity(makeEntity(id))
    setYjsClaim(existingClaim)
    addTombstone(id, 'entity-delete-device', 'entities')
    addTombstone(id, 'claim-delete-device', 'claims')

    reconcileMergedRecords(
      { entities: [], claims: [makeClaim(id, 'Merged claim')] },
      { entities: [], claims: [existingClaim] },
      { entities: new Set(), claims: new Set() },
    )

    const record = getSyncDoc().claims.get(id)
    if (!record) throw new Error('Expected the reconciled claim in the Yjs document')
    const clock = clockFromRecord(record)
    expect(clock['claim-delete-device']).toBe(1)
    expect(clock).not.toHaveProperty('entity-delete-device')
  })

  it('does not emit a Yjs update for an order-only tag and link difference', () => {
    const id = 'unordered-entity'
    const current = {
      ...makeEntity(id),
      tags: ['alpha', 'beta'],
      links: [
        { targetId: 'target-a', relation: 'references' },
        { targetId: 'target-b', relation: 'mentions' },
      ],
    }
    const merged = {
      ...current,
      tags: [...current.tags].reverse(),
      links: [...current.links].reverse(),
    }
    setYjsEntity(current)
    const doc = getDoc()
    const existingRecord = getSyncDoc().entities.get(id)
    if (!existingRecord) throw new Error('Expected the current entity in the Yjs document')
    const initialClock = clockFromRecord(existingRecord)
    let updateCount = 0
    const countUpdates = () => {
      updateCount += 1
    }
    doc.on('update', countUpdates)

    try {
      reconcileMergedRecords(
        { entities: [merged], claims: [] },
        { entities: [current], claims: [] },
        { entities: new Set(), claims: new Set() },
      )
    } finally {
      doc.off('update', countUpdates)
    }

    const finalRecord = getSyncDoc().entities.get(id)
    if (!finalRecord) throw new Error('Expected the current entity to remain in the Yjs document')
    expect(updateCount).toBe(0)
    expect(clockFromRecord(finalRecord)).toEqual(initialClock)
  })

  it('does not overwrite a record excluded for unresolved deletion', () => {
    const id = 'unresolved-claim-delete'
    const remoteClaim = makeClaim(id, 'Remote claim')
    setYjsClaim(remoteClaim)

    reconcileMergedRecords(
      { entities: [], claims: [makeClaim(id, 'Canonical claim')] },
      { entities: [], claims: [remoteClaim] },
      { entities: new Set(), claims: new Set([id]) },
    )

    expect(getSyncDoc().claims.get(id)?.statement).toBe('Remote claim')
  })
})
