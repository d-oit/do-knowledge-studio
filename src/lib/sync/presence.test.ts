import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockAwareness = {
  clientID: 1,
  setLocalStateField: vi.fn(),
  getLocalState: vi.fn(() => null),
  getStates: vi.fn(() => new Map()),
  on: vi.fn(),
  off: vi.fn(),
}

vi.mock('./doc', () => ({
  getAwareness: vi.fn(() => mockAwareness),
}))

vi.mock('./discovery', () => ({
  getDeviceId: vi.fn(() => 'local-device'),
  getDeviceName: vi.fn(() => 'Local Device'),
}))

import {
  setLocalPresence,
  updateCursor,
  updateCurrentView,
  getLocalPresence,
  getRemotePeers,
  getPeerCount,
  onPresenceChange,
  broadcastPresence,
} from './presence'
import { getAwareness } from './doc'

function resetAwareness(): void {
  mockAwareness.clientID = 1
  mockAwareness.setLocalStateField.mockReset()
  mockAwareness.getLocalState.mockReset().mockReturnValue(null)
  mockAwareness.getStates.mockReset().mockReturnValue(new Map())
  mockAwareness.on.mockReset()
  mockAwareness.off.mockReset()
  vi.mocked(getAwareness).mockReturnValue(mockAwareness)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(5000)
  resetAwareness()
})

afterEach(() => {
  vi.useRealTimers()
})

// --- setLocalPresence ---

describe('setLocalPresence', () => {
  it('merges partial overrides with defaults', () => {
    setLocalPresence({ currentView: 'editor' })

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('presence', {
      deviceId: 'local-device',
      name: 'Local Device',
      color: expect.any(String),
      cursor: null,
      currentView: 'editor',
      lastActive: 5000,
    })
  })

  it('early returns when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    setLocalPresence({ currentView: 'home' })
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled()
  })
})

// --- updateCursor ---

describe('updateCursor', () => {
  it('sets cursor position in awareness', () => {
    const existing = {
      deviceId: 'local-device',
      name: 'Local Device',
      color: '#ef4444',
      cursor: null,
      currentView: 'home',
      lastActive: 1000,
    }
    mockAwareness.getLocalState.mockReturnValue({ presence: existing })

    updateCursor(10, 20)

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('presence', {
      ...existing,
      cursor: { x: 10, y: 20 },
      lastActive: 5000,
    })
  })

  it('early returns when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    updateCursor(1, 2)
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled()
  })
})

// --- updateCurrentView ---

describe('updateCurrentView', () => {
  it('updates currentView in awareness', () => {
    const existing = {
      deviceId: 'local-device',
      name: 'Local Device',
      color: '#ef4444',
      cursor: null,
      currentView: 'home',
      lastActive: 1000,
    }
    mockAwareness.getLocalState.mockReturnValue({ presence: existing })

    updateCurrentView('graph')

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('presence', {
      ...existing,
      currentView: 'graph',
      lastActive: 5000,
    })
  })

  it('early returns when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    updateCurrentView('graph')
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled()
  })
})

// --- getLocalPresence ---

describe('getLocalPresence', () => {
  it('returns presence from local state', () => {
    const presence = {
      deviceId: 'local-device',
      name: 'Local',
      color: '#ef4444',
      cursor: null,
      currentView: 'home',
      lastActive: 5000,
    }
    mockAwareness.getLocalState.mockReturnValue({ presence })

    expect(getLocalPresence()).toEqual(presence)
  })

  it('returns null when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    expect(getLocalPresence()).toBeNull()
  })

  it('returns null when no presence in state', () => {
    mockAwareness.getLocalState.mockReturnValue({})
    expect(getLocalPresence()).toBeNull()
  })
})

// --- getRemotePeers ---

describe('getRemotePeers', () => {
  it('filters out local client by clientID', () => {
    const remote = {
      deviceId: 'remote-1',
      name: 'Remote',
      color: '#3b82f6',
      cursor: null,
      currentView: 'home',
      lastActive: 5000,
    }

    const states = new Map([
      [1, { presence: { deviceId: 'local-device', name: 'Local', color: '#ef4444', cursor: null, currentView: 'home', lastActive: 5000 } }],
      [2, { presence: remote }],
    ])
    mockAwareness.getStates.mockReturnValue(states)

    expect(getRemotePeers()).toEqual([remote])
  })

  it('returns empty when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    expect(getRemotePeers()).toEqual([])
  })

  it('excludes peers with matching local deviceId', () => {
    const states = new Map([
      [5, { presence: { deviceId: 'local-device', name: 'Dup', color: '#f00', cursor: null, currentView: 'home', lastActive: 1 } }],
      [6, { presence: { deviceId: 'other', name: 'Other', color: '#0f0', cursor: null, currentView: 'home', lastActive: 1 } }],
    ])
    mockAwareness.getStates.mockReturnValue(states)
    mockAwareness.clientID = 99 // different from map key 5

    const peers = getRemotePeers()
    expect(peers).toHaveLength(1)
    expect(peers[0].deviceId).toBe('other')
  })
})

// --- getPeerCount ---

describe('getPeerCount', () => {
  it('includes self in count', () => {
    const states = new Map([
      [2, { presence: { deviceId: 'r1', name: 'R1', color: '#f00', cursor: null, currentView: 'home', lastActive: 1 } }],
    ])
    mockAwareness.getStates.mockReturnValue(states)
    expect(getPeerCount()).toBe(2)
  })
})

// --- onPresenceChange ---

describe('onPresenceChange', () => {
  it('registers change handler and returns unsubscribe', () => {
    const cb = vi.fn()
    const unsub = onPresenceChange(cb)

    expect(mockAwareness.on).toHaveBeenCalledWith('change', expect.any(Function))

    // Simulate a change event
    const handler = mockAwareness.on.mock.calls[0][1] as () => void
    handler()
    expect(cb).toHaveBeenCalled()

    unsub()
    expect(mockAwareness.off).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('returns cleanup-only when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    const cb = vi.fn()
    const unsub = onPresenceChange(cb)

    unsub()
    expect(mockAwareness.on).not.toHaveBeenCalled()
  })
})

// --- broadcastPresence ---

describe('broadcastPresence', () => {
  it('updates lastActive timestamp', () => {
    const existing = {
      deviceId: 'local-device',
      name: 'Local',
      color: '#ef4444',
      cursor: null,
      currentView: 'home',
      lastActive: 1000,
    }
    mockAwareness.getLocalState.mockReturnValue({ presence: existing })

    broadcastPresence()

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith('presence', {
      ...existing,
      lastActive: 5000,
    })
  })

  it('early returns when awareness is null', () => {
    vi.mocked(getAwareness).mockReturnValue(null)
    broadcastPresence()
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled()
  })
})
