import { describe, expect, it } from 'vitest'
import type { Entity } from './types'
import {
  MAX_REVISION_BYTES,
  MAX_REVISIONS_PER_ENTITY,
  REVISION_THROTTLE_MS,
  entitySnapshotSignature,
  planEvictions,
  revisionBytes,
  shouldCaptureRevision,
  summarizeRevisionUsage,
  type EntityRevision,
  type RevisionReason,
} from './revision-model'

/** Entity fixture with a distinctive body. */
const makeEntity = (id: string, content = 'body'): Entity => ({
  id,
  name: `Entity ${id}`,
  type: 'note',
  description: '',
  content,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

/** Revision fixture. */
const makeRevision = (
  id: string,
  createdAt: string,
  options: { bytes?: number; reason?: RevisionReason } = {},
): EntityRevision => ({
  id,
  entityId: 'entity-1',
  createdAt,
  reason: options.reason ?? 'save',
  bytes: options.bytes ?? 100,
  entity: makeEntity('entity-1'),
})

describe('shouldCaptureRevision', () => {
  const base = makeEntity('entity-1', 'first')
  const next = makeEntity('entity-1', 'second')

  it('ignores a save that did not change the content', () => {
    expect(
      shouldCaptureRevision({ previous: base, next: base, reason: 'save', now: 1_000 }),
    ).toBe(false)
  })

  it('captures the first change of an entity', () => {
    expect(shouldCaptureRevision({ previous: base, next, reason: 'save', now: 1_000 })).toBe(true)
  })

  it('throttles repeated saves inside the window', () => {
    expect(
      shouldCaptureRevision({
        previous: base,
        next,
        reason: 'save',
        now: REVISION_THROTTLE_MS,
        lastCapturedAt: 0,
      }),
    ).toBe(true)
    expect(
      shouldCaptureRevision({
        previous: base,
        next,
        reason: 'save',
        now: REVISION_THROTTLE_MS - 1,
        lastCapturedAt: 0,
      }),
    ).toBe(false)
  })

  it('does not throttle discrete events such as a merge', () => {
    expect(
      shouldCaptureRevision({
        previous: base,
        next,
        reason: 'merge',
        now: 1,
        lastCapturedAt: 0,
      }),
    ).toBe(true)
  })

  it('still requires a real change for a merge or restore', () => {
    expect(shouldCaptureRevision({ previous: base, next: base, reason: 'restore', now: 5 })).toBe(
      false,
    )
  })

  it('treats an unknown previous version as changed', () => {
    expect(shouldCaptureRevision({ previous: null, next: base, reason: 'save', now: 1 })).toBe(true)
  })
})

describe('entitySnapshotSignature', () => {
  it('ignores updatedAt but notices every content field', () => {
    const first = makeEntity('entity-1', 'text')
    const bumped = { ...first, updatedAt: '2026-02-02T00:00:00.000Z' }
    expect(entitySnapshotSignature(first)).toBe(entitySnapshotSignature(bumped))
    expect(entitySnapshotSignature({ ...first, name: 'Renamed' })).not.toBe(
      entitySnapshotSignature(first),
    )
    expect(entitySnapshotSignature({ ...first, tags: ['x'] })).not.toBe(
      entitySnapshotSignature(first),
    )
  })
})

describe('planEvictions', () => {
  it('keeps the newest revisions and evicts the rest', () => {
    const revisions = Array.from({ length: MAX_REVISIONS_PER_ENTITY + 5 }, (_, index) =>
      makeRevision(`r-${String(index).padStart(2, '0')}`, `2026-03-01T00:00:${String(index % 60).padStart(2, '0')}.000Z`),
    )
    const evicted = planEvictions(revisions)
    // 20 newest plus at most one daily milestone for the older revisions.
    expect(evicted.length).toBeGreaterThanOrEqual(4)
    expect(evicted).toContain('r-00')
    expect(evicted).not.toContain(`r-${String(MAX_REVISIONS_PER_ENTITY + 4).padStart(2, '0')}`)
  })

  it('keeps a milestone for an older day beyond the newest window', () => {
    const recent = Array.from({ length: MAX_REVISIONS_PER_ENTITY }, (_, index) =>
      makeRevision(`recent-${index}`, `2026-03-02T00:00:${String(index).padStart(2, '0')}.000Z`),
    )
    const older = makeRevision('older-day', '2026-02-01T12:00:00.000Z')
    expect(planEvictions([...recent, older])).not.toContain('older-day')
  })

  it('evicts the oldest revisions until the byte budget fits', () => {
    const oneMegabyte = 1024 * 1024
    const revisions = Array.from({ length: 6 }, (_, index) =>
      makeRevision(`big-${index}`, `2026-03-01T00:00:0${index}.000Z`, { bytes: oneMegabyte }),
    )
    const evicted = planEvictions(revisions)
    expect(evicted.length).toBeGreaterThanOrEqual(2)
    expect(evicted).toContain('big-0')
    const remaining = revisions.filter((revision) => !evicted.includes(revision.id))
    expect(remaining.reduce((total, revision) => total + revision.bytes, 0)).toBeLessThanOrEqual(
      MAX_REVISION_BYTES,
    )
  })
})

describe('summarizeRevisionUsage', () => {
  it('counts revisions and adds their bytes', () => {
    expect(
      summarizeRevisionUsage([
        makeRevision('a', '2026-03-01T00:00:00.000Z', { bytes: 40 }),
        makeRevision('b', '2026-03-01T00:01:00.000Z', { bytes: 60 }),
      ]),
    ).toEqual({ count: 2, bytes: 100 })
  })
})

describe('revisionBytes', () => {
  it('grows with the entity body', () => {
    expect(revisionBytes(makeEntity('entity-1', 'x'.repeat(1_000)))).toBeGreaterThan(
      revisionBytes(makeEntity('entity-1', 'x')),
    )
  })
})
