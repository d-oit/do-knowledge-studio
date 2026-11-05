import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStudioStore } from './store'
import { snapshotCorpus } from './history-snapshot'
import type { Entity } from './types'

/** Entity fixture. */
const makeEntity = (id: string, content: string): Entity => ({
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

describe('restoreEntityRevision', () => {
  beforeEach(() => {
    useStudioStore.setState({
      entities: [makeEntity('entity-1', 'current text')],
      claims: [],
      entityHistory: [],
      historyIndex: -1,
    })
  })

  it('writes the restored text as the current entity', () => {
    useStudioStore.getState().restoreEntityRevision(makeEntity('entity-1', 'old text'))
    const entity = useStudioStore.getState().entities.find((item) => item.id === 'entity-1')
    expect(entity?.content).toBe('old text')
  })

  it('keeps the restore undoable', () => {
    // The app always has an earlier snapshot in history (the state it was
    // showing); seed that so undo has a target.
    const current = makeEntity('entity-1', 'current text')
    useStudioStore.setState({
      entityHistory: [
        snapshotCorpus([current], [], { graph: { nodes: [], edges: [] }, mindMap: { nodes: [], edges: [] }, links: [] }),
      ],
      historyIndex: 0,
    })
    useStudioStore.getState().restoreEntityRevision(makeEntity('entity-1', 'old text'))
    expect(useStudioStore.getState().historyIndex).toBe(1)
    useStudioStore.getState().undo()
    const entity = useStudioStore.getState().entities.find((item) => item.id === 'entity-1')
    expect(entity?.content).toBe('current text')
  })

  it('ignores a snapshot for an entity that no longer exists', () => {
    useStudioStore.getState().restoreEntityRevision(makeEntity('missing', 'old text'))
    expect(
      useStudioStore.getState().entities.some((entity) => entity.id === 'missing'),
    ).toBe(false)
  })
})
