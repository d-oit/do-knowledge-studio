import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  addTombstone,
  isTombstoned,
  getTombstone,
  getAllTombstones,
  clearTombstones,
} from './tombstones'
import { getDeviceId } from './discovery'
import { destroy, getDoc } from './doc'

beforeEach(() => {
  destroy()
})

afterEach(() => {
  destroy()
})

describe('tombstones', () => {
  it('adds and checks tombstone', () => {
    addTombstone('entity-1', 'peer-a')
    expect(isTombstoned('entity-1')).toBe(true)
    expect(isTombstoned('entity-2')).toBe(false)
  })

  it('gets tombstone details', () => {
    addTombstone('entity-1', 'peer-a')
    const t = getTombstone('entity-1')
    expect(t).not.toBeNull()
    expect(t!.id).toBe('entity-1')
    expect(t!.deletedBy).toBe('peer-a')
    expect(t!.deletedAt).toBeDefined()
  })

  it('returns null for non-existent tombstone', () => {
    expect(getTombstone('nonexistent')).toBeNull()
  })

  it('does not mutate the Yjs document when a tombstone lookup misses', () => {
    const doc = getDoc()
    let updateCount = 0
    const onUpdate = () => { updateCount += 1 }
    doc.on('update', onUpdate)
    try {
      expect(getTombstone('missing')).toBeNull()
      expect(getAllTombstones()).toEqual([])
      expect(updateCount).toBe(0)
    } finally {
      doc.off('update', onUpdate)
    }
  })

  it('gets all tombstones', () => {
    addTombstone('e1')
    addTombstone('e2')
    const all = getAllTombstones()
    expect(all).toHaveLength(2)
  })

  it('clears all tombstones', () => {
    addTombstone('e1')
    addTombstone('e2')
    clearTombstones()
    expect(getAllTombstones()).toHaveLength(0)
    expect(isTombstoned('e1')).toBe(false)
  })

  it('records the deleting device identity by default', () => {
    addTombstone('e1')
    expect(getTombstone('e1')?.deletedBy).toBe(getDeviceId())
  })
})
