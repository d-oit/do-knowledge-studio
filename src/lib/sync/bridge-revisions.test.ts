import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteCanonicalDatabase } from '@/lib/studio/canonical-storage-idb'
import { resetRevisionCaptureForTests } from '@/lib/studio/revision-capture'
import { listEntityRevisions } from '@/lib/studio/revision-storage'
import type { Entity } from '@/lib/studio/types'
import { applyRemoteUpdate } from './bridge'

/** Entity fixture; `updatedAt` drives which side wins the merge. */
const makeEntity = (content: string, updatedAt: string): Entity => ({
  id: 'entity-1',
  name: 'Shared note',
  type: 'note',
  description: '',
  content,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
  links: [],
})

/** Waits for the fire-and-forget capture to reach IndexedDB. */
const waitForRevisions = async (entityId: string): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const revisions = await listEntityRevisions(entityId)
    if (revisions.length > 0) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('no revision was captured')
}

describe('applyRemoteUpdate revisions', () => {
  beforeEach(async () => {
    resetRevisionCaptureForTests()
    await deleteCanonicalDatabase()
  })

  it('keeps the local text as a merge revision before the remote version wins', async () => {
    const local = makeEntity('local text', '2026-01-02T00:00:00.000Z')
    const remote = makeEntity('remote text', '2026-02-01T00:00:00.000Z')

    const result = applyRemoteUpdate([remote], [], [local], [])
    expect(result.entities[0]?.content).toBe('remote text')

    await waitForRevisions('entity-1')
    const [revision] = await listEntityRevisions('entity-1')
    expect(revision?.reason).toBe('merge')
    expect(revision?.entity.content).toBe('local text')
  })

  it('does not capture a revision when the merge leaves the local text unchanged', async () => {
    const local = makeEntity('same text', '2026-01-02T00:00:00.000Z')
    const remote = makeEntity('same text', '2026-02-01T00:00:00.000Z')

    applyRemoteUpdate([remote], [], [local], [])
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(await listEntityRevisions('entity-1')).toEqual([])
  })
})
