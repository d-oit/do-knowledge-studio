import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entity } from '@/lib/studio/types'
import { openCanonicalDatabase } from '@/lib/studio/canonical-storage-idb'
import { captureEntityRevision, resetRevisionCaptureForTests } from '@/lib/studio/revision-capture'
import { EntityRevisionsPanel } from './editor-revisions-panel'

/** Entity fixture. */
const makeEntity = (content: string): Entity => ({
  id: 'entity-1',
  name: 'Note',
  type: 'note',
  description: '',
  content,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

/** Removes the revision store between tests. */
const clearStore = async (): Promise<void> => {
  const db = await openCanonicalDatabase()
  const transaction = db.transaction('revisions', 'readwrite')
  transaction.objectStore('revisions').clear()
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

describe('EntityRevisionsPanel', () => {
  beforeEach(async () => {
    resetRevisionCaptureForTests()
    await clearStore()
  })

  it('lists stored versions and diffs the selected one against the current note', async () => {
    await captureEntityRevision({
      entity: makeEntity('older text\nshared line'),
      previous: null,
      reason: 'save',
      now: Date.UTC(2026, 2, 1),
    })
    render(<EntityRevisionsPanel entity={makeEntity('shared line\nnewer text')} onRestore={vi.fn()} />)

    const rows = await screen.findAllByRole('button', { name: /Restore the version from/ })
    expect(rows.length).toBeGreaterThanOrEqual(0)
    await waitFor(() => {
      expect(screen.getByText(/older text/)).toBeDefined()
    })
    expect(screen.getByText(/newer text/)).toBeDefined()
    expect(screen.getByText(/1 version/)).toBeDefined()
  })

  it('passes the selected snapshot to the restore handler', async () => {
    await captureEntityRevision({
      entity: makeEntity('revision body'),
      previous: null,
      reason: 'merge',
      now: Date.UTC(2026, 2, 1),
    })
    const onRestore = vi.fn()
    render(<EntityRevisionsPanel entity={makeEntity('current body')} onRestore={onRestore} />)

    const restore = await screen.findByRole('button', { name: /Restore the version from/ })
    fireEvent.click(restore)
    expect(onRestore).toHaveBeenCalledTimes(1)
    const snapshot = onRestore.mock.calls[0]?.[0] as Entity | undefined
    expect(snapshot?.content).toBe('revision body')
  })

  it('says there is nothing to show before the first revision', async () => {
    render(<EntityRevisionsPanel entity={makeEntity('only body')} onRestore={vi.fn()} />)
    expect(await screen.findByText(/No earlier versions yet/)).toBeDefined()
  })
})
