import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStudioStore } from './store'
import {
  initCrossTabSync,
  stopCrossTabSync,
  applyRemoteEnvelope,
  TAB_ORIGIN_ID,
  STUDIO_CROSS_TAB_CHANNEL,
  getIsApplyingRemoteUpdate,
} from './cross-tab'
import { STUDIO_STORAGE_KEY } from './hydration'
import type { Entity, Claim } from './types'

const ENTITY_A: Entity = {
  id: 'ent-a',
  name: 'Entity A from Tab A',
  type: 'note',
  description: 'Description A',
  content: 'Content A',
  tags: ['tab-a'],
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  links: [],
}

const ENTITY_B: Entity = {
  id: 'ent-b',
  name: 'Entity B from Tab B',
  type: 'concept',
  description: 'Description B',
  content: 'Content B',
  tags: ['tab-b'],
  createdAt: '2026-01-01T11:00:00.000Z',
  updatedAt: '2026-01-01T11:00:00.000Z',
  links: [],
}

const CLAIM_A: Claim = {
  id: 'claim-a',
  entityId: 'ent-a',
  statement: 'Statement A from Tab A',
  confidence: 0.9,
  verification: 'verified',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  version: 1,
}

const CLAIM_B: Claim = {
  id: 'claim-b',
  entityId: 'ent-b',
  statement: 'Statement B from Tab B',
  confidence: 0.8,
  verification: 'unverified',
  createdAt: '2026-01-01T11:00:00.000Z',
  updatedAt: '2026-01-01T11:00:00.000Z',
  version: 1,
}

describe('cross-tab store coordination', () => {
  beforeEach(() => {
    stopCrossTabSync()
    useStudioStore.setState({
      entities: [],
      claims: [],
      entityHistory: [[]],
      historyIndex: 0,
    })
  })

  afterEach(() => {
    stopCrossTabSync()
  })

  it('performs field-level entity merge without overwriting local tab entities', () => {
    // Tab B local state has ENTITY_B
    useStudioStore.setState({ entities: [ENTITY_B] })

    // Tab A remote state has ENTITY_A
    const remoteSlice = {
      entities: [ENTITY_A],
      claims: [],
    }

    const applied = applyRemoteEnvelope(remoteSlice, 'tab-a-origin')
    expect(applied).toBe(true)

    const current = useStudioStore.getState().entities
    expect(current).toHaveLength(2)
    expect(current.some((e) => e.id === 'ent-a')).toBe(true)
    expect(current.some((e) => e.id === 'ent-b')).toBe(true)
  })

  it('performs field-level claim merge without overwriting local tab claims', () => {
    // Tab B local state has CLAIM_B
    useStudioStore.setState({ claims: [CLAIM_B] })

    // Tab A remote state has CLAIM_A
    const remoteSlice = {
      entities: [],
      claims: [CLAIM_A],
    }

    const applied = applyRemoteEnvelope(remoteSlice, 'tab-a-origin')
    expect(applied).toBe(true)

    const currentClaims = useStudioStore.getState().claims
    expect(currentClaims).toHaveLength(2)
    expect(currentClaims.some((c) => c.id === 'claim-a')).toBe(true)
    expect(currentClaims.some((c) => c.id === 'claim-b')).toBe(true)
  })

  it('guards against feedback loops by ignoring envelopes from the same tab origin', () => {
    useStudioStore.setState({ entities: [ENTITY_B] })

    const remoteSlice = {
      entities: [ENTITY_A],
      claims: [],
    }

    // Call with matching TAB_ORIGIN_ID
    const applied = applyRemoteEnvelope(remoteSlice, TAB_ORIGIN_ID)
    expect(applied).toBe(false)

    // Store state remains untouched
    const current = useStudioStore.getState().entities
    expect(current).toHaveLength(1)
    expect(current[0].id).toBe('ent-b')
  })

  it('safely rejects corrupt or invalid persistence envelopes', () => {
    useStudioStore.setState({ entities: [ENTITY_B] })

    const invalidPayloads = [
      null,
      undefined,
      'not-an-object',
      { entities: 'not-an-array' },
      { entities: [{ id: 'bad', type: 'invalid-enum-type' }] },
    ]

    invalidPayloads.forEach((payload) => {
      const applied = applyRemoteEnvelope(payload, 'tab-a-origin')
      expect(applied).toBe(false)
    })

    expect(useStudioStore.getState().entities).toHaveLength(1)
    expect(useStudioStore.getState().entities[0].id).toBe('ent-b')
  })

  it('ignores redundant updates when remote data matches local state', () => {
    useStudioStore.setState({ entities: [ENTITY_A], claims: [CLAIM_A] })

    const matchingPayload = {
      entities: [ENTITY_A],
      claims: [CLAIM_A],
    }

    const applied = applyRemoteEnvelope(matchingPayload, 'tab-a-origin')
    expect(applied).toBe(false)
  })

  it('manages isApplyingRemoteUpdate flag state during remote application', () => {
    expect(getIsApplyingRemoteUpdate()).toBe(false)

    const remoteSlice = {
      entities: [ENTITY_A],
      claims: [],
    }

    applyRemoteEnvelope(remoteSlice, 'tab-a-origin')
    expect(getIsApplyingRemoteUpdate()).toBe(false)
  })

  it('subscribes and cleans up BroadcastChannel and window storage listener on init/stop', () => {
    expect(STUDIO_CROSS_TAB_CHANNEL).toBe('do-knowledge-studio-crosstab')
    const postMessageMock = vi.fn()
    const closeMock = vi.fn()

    class MockBroadcastChannel {
      name: string
      onmessage: ((ev: MessageEvent) => void) | null = null
      constructor(name: string) {
        this.name = name
      }
      postMessage(msg: unknown) {
        postMessageMock(msg)
      }
      close() {
        closeMock()
      }
    }

    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const cleanup = initCrossTabSync()
    expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function))

    cleanup()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function))
    expect(closeMock).toHaveBeenCalled()

    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('handles window storage events from other tabs correctly', () => {
    useStudioStore.setState({ entities: [ENTITY_B] })

    let storageHandler: ((e: StorageEvent) => void) | null = null
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'storage') {
        storageHandler = handler as (e: StorageEvent) => void
      }
    })

    initCrossTabSync()
    expect(storageHandler).not.toBeNull()

    // Simulate storage event from another tab
    const event = new StorageEvent('storage', {
      key: STUDIO_STORAGE_KEY,
      newValue: JSON.stringify({
        state: {
          entities: [ENTITY_A],
          claims: [],
        },
        version: 5,
      }),
    })

    storageHandler!(event)

    const current = useStudioStore.getState().entities
    expect(current).toHaveLength(2)

    addEventListenerSpy.mockRestore()
  })
})
