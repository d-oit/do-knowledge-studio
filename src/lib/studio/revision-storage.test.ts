import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  closeCanonicalDatabase,
  deleteCanonicalDatabase,
  openCanonicalDatabase,
} from './canonical-storage-idb'
import { captureEntityRevision, resetRevisionCaptureForTests } from './revision-capture'
import { MAX_REVISIONS_PER_ENTITY, REVISION_THROTTLE_MS, type EntityRevision } from './revision-model'
import {
  appendEntityRevision,
  listEntityRevisions,
  readRevisionUsage,
} from './revision-storage'
import type { Entity } from './types'

/** Entity fixture; the body is what the throttle compares. */
const makeEntity = (id: string, content = 'first draft'): Entity => ({
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
  entityId: string,
  createdAt: string,
  bytes = 100,
): EntityRevision => ({
  id,
  entityId,
  createdAt,
  reason: 'save',
  bytes,
  entity: makeEntity(entityId),
})

describe('revision storage', () => {
  beforeEach(async () => {
    resetRevisionCaptureForTests()
    await deleteCanonicalDatabase()
  })

  it('lists one entity&apos;s revisions newest first', async () => {
    await appendEntityRevision(makeRevision('older', 'entity-1', '2026-03-01T00:00:00.000Z'))
    await appendEntityRevision(makeRevision('newer', 'entity-1', '2026-03-02T00:00:00.000Z'))
    await appendEntityRevision(makeRevision('other', 'entity-2', '2026-03-03T00:00:00.000Z'))

    const revisions = await listEntityRevisions('entity-1')
    expect(revisions.map((revision) => revision.id)).toEqual(['newer', 'older'])
  })

  it('keeps revisions across a database reopen (a reload)', async () => {
    await appendEntityRevision(makeRevision('kept', 'entity-1', '2026-03-01T00:00:00.000Z'))
    await closeCanonicalDatabase()

    const revisions = await listEntityRevisions('entity-1')
    expect(revisions.map((revision) => revision.id)).toEqual(['kept'])
  })

  it('skips a malformed record instead of failing the list', async () => {
    await appendEntityRevision(makeRevision('good', 'entity-1', '2026-03-01T00:00:00.000Z'))
    const db = await openCanonicalDatabase()
    const transaction = db.transaction('revisions', 'readwrite')
    transaction.objectStore('revisions').put({ id: 'broken', entityId: 'entity-1' })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })

    const revisions = await listEntityRevisions('entity-1')
    expect(revisions.map((revision) => revision.id)).toEqual(['good'])
  })

  it('throttles a save but always keeps a merge snapshot', async () => {
    const first = makeEntity('entity-1', 'draft one')
    const second = makeEntity('entity-1', 'draft two')
    const now = 1_000_000

    expect(
      await captureEntityRevision({ entity: first, previous: null, reason: 'save', now }),
    ).toBe(true)
    expect(
      await captureEntityRevision({ entity: second, previous: first, reason: 'save', now: now + 1 }),
    ).toBe(false)
    expect(
      await captureEntityRevision({
        entity: second,
        previous: first,
        reason: 'save',
        now: now + REVISION_THROTTLE_MS,
      }),
    ).toBe(true)
    expect(
      await captureEntityRevision({
        entity: first,
        previous: second,
        reason: 'merge',
        now: now + REVISION_THROTTLE_MS + 1_000,
      }),
    ).toBe(true)

    const revisions = await listEntityRevisions('entity-1')
    expect(revisions.map((revision) => revision.reason)).toEqual(['merge', 'save', 'save'])
  })

  it('evicts old revisions past the per-entity retention limit', async () => {
    const entity = makeEntity('entity-1')
    for (let index = 0; index < MAX_REVISIONS_PER_ENTITY + 5; index += 1) {
      await appendEntityRevision(
        makeRevision(
          `revision-${String(index).padStart(2, '0')}`,
          'entity-1',
          new Date(Date.UTC(2026, 2, 1, 0, 0, index)).toISOString(),
        ),
      )
    }
    // A later capture triggers retention on the entity.
    await captureEntityRevision({
      entity: { ...entity, content: 'after retention' },
      previous: entity,
      reason: 'restore',
      now: Date.UTC(2026, 2, 2),
    })

    const revisions = await listEntityRevisions('entity-1')
    // Policy: newest 20 plus one milestone per older day (all older revisions
    // here are the same day, so exactly one extra may survive).
    expect(revisions.length).toBeLessThanOrEqual(MAX_REVISIONS_PER_ENTITY + 1)
    expect(revisions[0]?.reason).toBe('restore')
  })

  it('keeps the global store inside its byte budget, oldest first', async () => {
    const oneMegabyte = 1024 * 1024
    for (let index = 0; index < 6; index += 1) {
      await appendEntityRevision(
        makeRevision(
          `big-${index}`,
          `entity-${index}`,
          `2026-03-01T00:00:0${index}.000Z`,
          oneMegabyte,
        ),
      )
    }
    // Any capture runs the global budget pass.
    await captureEntityRevision({
      entity: makeEntity('trigger'),
      previous: null,
      reason: 'merge',
      now: Date.UTC(2026, 2, 2),
    })

    const usage = await readRevisionUsage()
    expect(usage.bytes).toBeLessThanOrEqual(4 * 1024 * 1024)
  })
})
