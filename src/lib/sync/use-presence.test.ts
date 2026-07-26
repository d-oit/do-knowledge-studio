import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUnsubscribe = vi.fn()

const mockLocalPresence = {
  deviceId: 'local',
  name: 'Test Device',
  color: '#ef4444',
  cursor: null,
  currentView: 'home',
  lastActive: Date.now(),
}

let presenceCallback: ((peers: never[]) => void) | null = null

vi.mock('./presence', () => ({
  onPresenceChange: vi.fn((cb: (peers: never[]) => void) => {
    presenceCallback = cb
    return mockUnsubscribe
  }),
  setLocalPresence: vi.fn(),
  getLocalPresence: vi.fn(() => mockLocalPresence),
  updateCurrentView: vi.fn(),
}))

vi.mock('./discovery', () => ({
  getDeviceName: vi.fn(() => 'Test Device'),
}))

import { usePresence } from './use-presence'
import {
  onPresenceChange,
  setLocalPresence,
  getLocalPresence,
  updateCurrentView,
} from './presence'
import { getDeviceName } from './discovery'

beforeEach(() => {
  vi.clearAllMocks()
  presenceCallback = null
  ;(onPresenceChange as ReturnType<typeof vi.fn>).mockImplementation(
    (cb: (peers: never[]) => void) => {
      presenceCallback = cb
      return mockUnsubscribe
    },
  )
  ;(getLocalPresence as ReturnType<typeof vi.fn>).mockReturnValue(mockLocalPresence)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePresence', () => {
  it('returns initial state with empty peers and peerCount of 1', () => {
    const { result } = renderHook(() => usePresence())
    expect(result.current.peers).toEqual([])
    expect(result.current.peerCount).toBe(1)
  })

  it('calls setLocalPresence with name and currentView on mount', () => {
    renderHook(() => usePresence())
    expect(setLocalPresence).toHaveBeenCalledWith({
      name: 'Test Device',
      currentView: 'home',
    })
  })

  it('calls getDeviceName on mount', () => {
    renderHook(() => usePresence())
    expect(getDeviceName).toHaveBeenCalledTimes(1)
  })

  it('calls onPresenceChange on mount', () => {
    renderHook(() => usePresence())
    expect(onPresenceChange).toHaveBeenCalledTimes(1)
  })

  it('setPresence calls setLocalPresence with partial data', () => {
    const { result } = renderHook(() => usePresence())
    act(() => {
      result.current.setPresence({ name: 'Updated Name' })
    })
    expect(setLocalPresence).toHaveBeenCalledWith({ name: 'Updated Name' })
  })

  it('setCurrentView calls updateCurrentView', () => {
    const { result } = renderHook(() => usePresence())
    act(() => {
      result.current.setCurrentView('editor')
    })
    expect(updateCurrentView).toHaveBeenCalledWith('editor')
  })

  it('onPresenceChange callback updates peers and peerCount', () => {
    const { result } = renderHook(() => usePresence())
    const remotePeers = [
      {
        deviceId: 'peer-1',
        name: 'Alice',
        color: '#3b82f6',
        cursor: null,
        currentView: 'editor',
        lastActive: Date.now(),
      },
    ]

    act(() => {
      presenceCallback!(remotePeers as never)
    })

    expect(result.current.peers).toEqual(remotePeers)
    expect(result.current.peerCount).toBe(2)
  })

  it('peerCount includes local device (+1 for each remote peer)', () => {
    const { result } = renderHook(() => usePresence())
    const remotePeers = [
      { deviceId: 'peer-1', name: 'Alice', color: '#ef4444', cursor: null, currentView: 'home', lastActive: 0 },
      { deviceId: 'peer-2', name: 'Bob', color: '#3b82f6', cursor: null, currentView: 'home', lastActive: 0 },
    ]

    act(() => {
      presenceCallback!(remotePeers as never)
    })

    expect(result.current.peerCount).toBe(3)
    expect(result.current.peers).toHaveLength(2)
  })

  it('localPresence returns getLocalPresence result', () => {
    const { result } = renderHook(() => usePresence())
    expect(result.current.localPresence).toEqual(mockLocalPresence)
  })

  it('onPresenceChange with empty array resets peers', () => {
    const { result } = renderHook(() => usePresence())

    act(() => {
      presenceCallback!([
        { deviceId: 'peer-1', name: 'Alice', color: '#ef4444', cursor: null, currentView: 'home', lastActive: 0 },
      ] as never)
    })
    expect(result.current.peers).toHaveLength(1)

    act(() => {
      presenceCallback!([] as never)
    })
    expect(result.current.peers).toEqual([])
    expect(result.current.peerCount).toBe(1)
  })

  it('cleanup unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => usePresence())
    expect(mockUnsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
