import { describe, expect, it } from 'vitest'
import type { Entity } from './types'
import {
  entitySnapshotSignature,
  planEvictions,
  shouldCaptureRevision,
  type EntityRevision,
} from './revision-model'

/** Realistic long note body: 50k characters is a large but normal note. */
const LONG_BODY = 'saffron knowledge studio '.repeat(2_000)

/** Entity fixture. */
const makeEntity = (content: string): Entity => ({
  id: 'entity-1',
  name: 'Large note',
  type: 'note',
  description: 'A long note',
  content,
  tags: ['long', 'note'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

/** Revision fixture. */
const makeRevision = (id: string, createdAt: string): EntityRevision => ({
  id,
  entityId: 'entity-1',
  createdAt,
  reason: 'save',
  bytes: 1_000,
  entity: makeEntity('body'),
})

describe('revision capture cost', () => {
  it('decides on a 50k-character note within 200 ms for 200 saves', () => {
    const before = makeEntity(LONG_BODY)
    const after = makeEntity(`${LONG_BODY} edited`)
    const started = performance.now()
    for (let index = 0; index < 200; index += 1) {
      shouldCaptureRevision({
        previous: before,
        next: after,
        reason: 'save',
        now: index * 1_000,
        lastCapturedAt: 0,
      })
    }
    const elapsed = performance.now() - started
    // One decision is ~1/200th of this budget: the save path calls it once per
    // commit, so 200 saves must stay far inside a frame budget in aggregate.
    expect(elapsed).toBeLessThan(200)
  })

  it('signs a 50k-character note in well under a millisecond per save', () => {
    const entity = makeEntity(LONG_BODY)
    const signature = entitySnapshotSignature(entity)
    expect(signature.length).toBeGreaterThan(LONG_BODY.length)
    const iterations = 200
    const started = performance.now()
    for (let index = 0; index < iterations; index += 1) {
      entitySnapshotSignature(entity)
    }
    const elapsed = performance.now() - started
    // The save path signs at most twice per commit (previous + next).
    expect(elapsed / iterations).toBeLessThan(1)
    expect(elapsed).toBeLessThan(150)
  })

  it('plans eviction for 1000 revisions within 50 ms', () => {
    const revisions = Array.from({ length: 1_000 }, (_, index) =>
      makeRevision(`revision-${index}`, new Date(Date.UTC(2026, 2, 1, 0, index)).toISOString()),
    )
    const started = performance.now()
    const evicted = planEvictions(revisions)
    expect(evicted.length).toBeGreaterThan(0)
    expect(performance.now() - started).toBeLessThan(50)
  })
})
