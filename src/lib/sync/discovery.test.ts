import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('./doc', () => ({ getAwareness: vi.fn(() => null) }))

const mockBroadcastChannel = vi.fn()
const postedMessages: unknown[] = []
let messageHandler: ((event: MessageEvent) => void) | null = null

mockBroadcastChannel.prototype.postMessage = vi.fn((msg: unknown) => {
  postedMessages.push(msg)
})
mockBroadcastChannel.prototype.close = vi.fn()
Object.defineProperty(mockBroadcastChannel.prototype, 'onmessage', {
  set(fn: (event: MessageEvent) => void) {
    messageHandler = fn
  },
  get() {
    return messageHandler
  },
})

vi.stubGlobal('BroadcastChannel', mockBroadcastChannel)

// --- getDeviceId / getDeviceName: module-level state requires fresh imports ---

describe('getDeviceId', () => {
  it('generates a UUID on first call and persists it', async () => {
    const { getDeviceId } = await import('./discovery')
    const id = getDeviceId()
    expect(id).toBeTypeOf('string')
    expect(id).toHaveLength(36)
    expect(localStorage.getItem('dks-device-id')).toBe(id)
  })

  it('returns cached ID on subsequent calls', async () => {
    const { getDeviceId } = await import('./discovery')
    const first = getDeviceId()
    const second = getDeviceId()
    expect(second).toBe(first)
  })

  it('restores from localStorage when available', async () => {
    vi.resetModules()
    localStorage.setItem('dks-device-id', 'stored-id')
    const { getDeviceId: freshGetDeviceId } = await import('./discovery')
    expect(freshGetDeviceId()).toBe('stored-id')
  })
})

describe('getDeviceName', () => {
  it('returns fallback format when no name stored', async () => {
    vi.resetModules()
    localStorage.clear()
    const { getDeviceName: freshGetDeviceName } = await import('./discovery')
    const name = freshGetDeviceName()
    expect(name).toMatch(/^Device [a-f0-9]{6}$/)
  })

  it('returns stored name when available', async () => {
    vi.resetModules()
    localStorage.setItem('dks-device-name', 'My Device')
    const { getDeviceName: freshGetDeviceName } = await import('./discovery')
    expect(freshGetDeviceName()).toBe('My Device')
  })
})

// --- Remaining tests use shared module with stopDiscovery() for cleanup ---

let discovery: typeof import('./discovery')

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1000)
  postedMessages.length = 0
  messageHandler = null
  vi.resetModules()
  discovery = await import('./discovery')
})

afterEach(() => {
  discovery.stopDiscovery()
  vi.useRealTimers()
})

// --- setDeviceName ---

describe('setDeviceName', () => {
  it('persists name to localStorage and updates cached value', () => {
    discovery.setDeviceName('New Name')
    expect(localStorage.getItem('dks-device-name')).toBe('New Name')
    expect(discovery.getDeviceName()).toBe('New Name')
  })
})

// --- startDiscovery / stopDiscovery ---

describe('startDiscovery', () => {
  it('posts initial presence message on the broadcast channel', () => {
    discovery.startDiscovery('room-1', vi.fn())
    expect(postedMessages).toHaveLength(1)
    const msg = postedMessages[0] as {
      roomId: string
      capabilities: string[]
    }
    expect(msg.roomId).toBe('room-1')
    expect(msg.capabilities).toEqual(['sync', 'voice'])
  })

  it('posts periodic heartbeat messages', () => {
    discovery.startDiscovery('room-1', vi.fn())
    postedMessages.length = 0

    vi.advanceTimersByTime(5000)
    expect(postedMessages).toHaveLength(1)

    vi.advanceTimersByTime(5000)
    expect(postedMessages).toHaveLength(2)
  })

  it('invokes callback with peers from same room', () => {
    const callback = vi.fn()
    discovery.startDiscovery('room-1', callback)

    messageHandler?.({
      data: {
        deviceId: 'remote-device',
        deviceName: 'Remote',
        roomId: 'room-1',
        lastSeen: Date.now(),
        capabilities: ['sync'],
      },
    } as MessageEvent)

    expect(callback).toHaveBeenCalledTimes(1)
    const peers = callback.mock.calls[0][0] as Array<{ deviceId: string }>
    expect(peers).toHaveLength(1)
    expect(peers[0].deviceId).toBe('remote-device')
  })

  it('ignores messages from self', () => {
    const callback = vi.fn()
    discovery.startDiscovery('room-1', callback)
    const selfId = discovery.getDeviceId()

    messageHandler?.({
      data: {
        deviceId: selfId,
        deviceName: 'Self',
        roomId: 'room-1',
        lastSeen: Date.now(),
        capabilities: ['sync'],
      },
    } as MessageEvent)

    expect(callback).not.toHaveBeenCalled()
  })

  it('filters peers by room on heartbeat', () => {
    const callback = vi.fn()
    discovery.startDiscovery('room-1', callback)

    messageHandler?.({
      data: {
        deviceId: 'other',
        deviceName: 'Other',
        roomId: 'room-2',
        lastSeen: Date.now(),
        capabilities: ['sync'],
      },
    } as MessageEvent)

    callback.mockClear()
    vi.advanceTimersByTime(5000)

    const peers = callback.mock.calls[0]?.[0] as Array<{ roomId: string }> | undefined
    if (peers) {
      expect(peers.every((p) => p.roomId === 'room-1')).toBe(true)
    }
  })
})

describe('stopDiscovery', () => {
  it('clears interval, closes channel, and clears peers', () => {
    discovery.startDiscovery('room-1', vi.fn())
    discovery.stopDiscovery()

    const before = postedMessages.length
    vi.advanceTimersByTime(10000)
    expect(postedMessages).toHaveLength(before)
    expect(discovery.getAvailableRooms()).toEqual([])
  })
})

// --- getAvailableRooms ---

describe('getAvailableRooms', () => {
  it('returns empty array when no peers', () => {
    expect(discovery.getAvailableRooms()).toEqual([])
  })

  it('groups peers by roomId', () => {
    discovery.startDiscovery('room-1', vi.fn())

    messageHandler?.({
      data: {
        deviceId: 'peer-a',
        deviceName: 'A',
        roomId: 'room-1',
        lastSeen: Date.now(),
        capabilities: [],
      },
    } as MessageEvent)
    messageHandler?.({
      data: {
        deviceId: 'peer-b',
        deviceName: 'B',
        roomId: 'room-2',
        lastSeen: Date.now(),
        capabilities: [],
      },
    } as MessageEvent)

    const rooms = discovery.getAvailableRooms()
    expect(rooms).toHaveLength(2)
    expect(rooms).toEqual(
      expect.arrayContaining([
        { roomId: 'room-1', peerCount: 1 },
        { roomId: 'room-2', peerCount: 1 },
      ]),
    )
  })

  it('removes stale peers (PEER_TIMEOUT)', () => {
    discovery.startDiscovery('room-1', vi.fn())

    messageHandler?.({
      data: {
        deviceId: 'stale-peer',
        deviceName: 'Stale',
        roomId: 'room-1',
        lastSeen: 1000,
        capabilities: [],
      },
    } as MessageEvent)

    vi.setSystemTime(17000)
    vi.advanceTimersByTime(5000)

    expect(discovery.getAvailableRooms()).toEqual([])
  })
})

// --- SIGNALING_SERVERS ---

describe('SIGNALING_SERVERS', () => {
  it('exports two signaling endpoints', () => {
    expect(discovery.SIGNALING_SERVERS).toHaveLength(2)
    expect(discovery.SIGNALING_SERVERS[0]).toContain('yjs.dev')
    expect(discovery.SIGNALING_SERVERS[1]).toContain('herokuapp.com')
  })
})
