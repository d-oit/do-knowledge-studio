import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Options every mocked provider was constructed with, in call order. */
const constructedOptions: unknown[] = []

vi.mock('y-webrtc', () => ({
  WebrtcProvider: class MockWebrtcProvider {
    awareness = { on: vi.fn(), off: vi.fn(), setLocalStateField: vi.fn(), getStates: () => new Map() }
    destroy = vi.fn()
    connect = vi.fn()
    disconnect = vi.fn()
    connected = false
    signalingUrls: string[] = ['wss://signaling.example.com']
    room = null

    constructor(_name: string, _doc: unknown, options?: unknown) {
      constructedOptions.push(options)
    }
  },
}))

vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: class MockIndexeddbPersistence {
    whenSynced = Promise.resolve()
    destroy = vi.fn()
    get = async (): Promise<unknown> => null
    set = async (): Promise<void> => undefined
  },
}))

const { destroy, joinRoom, reconnectRoom } = await import('./doc')

beforeEach(() => {
  constructedOptions.length = 0
  destroy()
})

afterEach(() => {
  destroy()
})

/** The options of the most recently constructed provider. */
interface ProviderOptions {
  peerOpts?: { config?: { iceServers?: RTCIceServer[] } }
}

const latestOptions = (): ProviderOptions => constructedOptions.at(-1) as ProviderOptions

describe('join room ICE configuration', () => {
  it('passes configured ICE servers to the WebRTC provider', () => {
    joinRoom('room-a', {
      iceServers: [
        { urls: ['stun:stun.example.com:3478'] },
        { urls: ['turns:relay.example.com:5349'], username: 'user', credential: 'secret' },
      ],
    })

    expect(latestOptions().peerOpts?.config?.iceServers).toEqual([
      { urls: ['stun:stun.example.com:3478'] },
      { urls: ['turns:relay.example.com:5349'], username: 'user', credential: 'secret' },
    ])
  })

  it('leaves the provider defaults untouched when no ICE servers are configured', () => {
    joinRoom('room-b')
    expect(latestOptions().peerOpts).toBeUndefined()
  })

  it('reuses the provider for identical options and replaces it when the ICE list changes', () => {
    const iceServers = [{ urls: ['stun:stun.example.com:3478'] }]
    const first = joinRoom('room-c', { iceServers })
    const same = joinRoom('room-c', { iceServers: [{ urls: ['stun:stun.example.com:3478'] }] })
    expect(same).toBe(first)
    expect(constructedOptions).toHaveLength(1)

    joinRoom('room-c', { iceServers: [{ urls: ['stun:other.example.com:3478'] }] })
    expect(constructedOptions).toHaveLength(2)
    expect(latestOptions().peerOpts?.config?.iceServers).toEqual([
      { urls: ['stun:other.example.com:3478'] },
    ])
  })

  it('keeps the configured ICE servers across a reconnect', () => {
    joinRoom('room-d', {
      iceServers: [{ urls: ['turns:relay.example.com:5349'], username: 'user', credential: 'secret' }],
    })
    reconnectRoom()
    expect(latestOptions().peerOpts?.config?.iceServers).toEqual([
      { urls: ['turns:relay.example.com:5349'], username: 'user', credential: 'secret' },
    ])
  })
})
