import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entity } from '@/lib/studio/types'
import { destroyBridge, getYjsEntities, onYjsChange, setYjsEntity } from './bridge'
import { destroy, getDoc, getProvider, joinRoom, leaveRoom } from './doc'

const mockProviders: Array<{ destroy: () => void; awareness: object }> = []

vi.mock('y-webrtc', () => {
  class MockWebrtcProvider {
    awareness = {}
    destroy = vi.fn()

    constructor(..._args: unknown[]) {
      mockProviders.push(this)
    }
  }

  return { WebrtcProvider: MockWebrtcProvider }
})

const makeEntity = (id: string): Entity => ({
  id,
  name: `Entity ${id}`,
  type: 'note',
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

beforeEach(() => {
  destroyBridge()
  destroy()
  mockProviders.length = 0
})

afterEach(() => {
  destroyBridge()
  destroy()
})

describe('leaveRoom', () => {
  it('keeps the Yjs document, its data, and change observers available for rejoin', () => {
    const doc = getDoc()
    const beforeLeave = makeEntity('before-leave')
    setYjsEntity(beforeLeave)
    const onChange = vi.fn()
    const unsubscribe = onYjsChange(onChange)

    joinRoom('room-a')
    leaveRoom()

    expect(mockProviders).toHaveLength(1)
    expect(mockProviders[0]?.destroy).toHaveBeenCalledTimes(1)
    expect(getProvider()).toBeNull()
    expect(getDoc()).toBe(doc)
    expect(getYjsEntities()).toEqual([beforeLeave])

    const afterLeave = makeEntity('after-leave')
    setYjsEntity(afterLeave)
    expect(onChange).toHaveBeenCalledWith([beforeLeave, afterLeave], [])

    unsubscribe()
  })
})
