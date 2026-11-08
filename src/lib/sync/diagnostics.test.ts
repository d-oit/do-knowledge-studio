import { describe, expect, it } from 'vitest'
import type { RoomProvider } from './doc'
import {
  collectSyncConnectionSnapshot,
  deriveConnectionHint,
  toCandidateKind,
} from './diagnostics'

/** A stats report covering the selected pair and its local candidate. */
const makeStatsReport = (
  candidateType: string,
  state = 'succeeded',
): RTCStatsReport => {
  const reports = new Map<string, unknown>([
    ['pair-1', { type: 'candidate-pair', state, selected: true, localCandidateId: 'candidate-1' }],
    ['candidate-1', { type: 'local-candidate', candidateType }],
  ])
  return {
    get: (id: string) => reports.get(id),
    forEach: (callback: (value: unknown) => void) => {
      for (const value of reports.values()) callback(value)
    },
  } as unknown as RTCStatsReport
}

/** Minimal provider stub: only the fields diagnostics reads. */
const makeProvider = (options: {
  connected: boolean
  signalingUrls?: string[]
  peers?: { iceConnectionState: RTCIceConnectionState; report?: RTCStatsReport }[]
}): RoomProvider => {
  const webrtcConns = new Map(
    (options.peers ?? []).map((peer, index) => [
      `peer-${String(index)}`,
      {
        peer: {
          _pc: {
            iceConnectionState: peer.iceConnectionState,
            getStats: async () => peer.report ?? makeStatsReport('host'),
          },
        },
      },
    ]),
  )
  return {
    connected: options.connected,
    signalingUrls: options.signalingUrls ?? ['wss://signaling.example.com'],
    room: webrtcConns.size === 0 ? null : { webrtcConns },
  } as unknown as RoomProvider
}

describe('toCandidateKind', () => {
  it('maps browser candidate types and defaults to unknown', () => {
    expect(toCandidateKind('host')).toBe('host')
    expect(toCandidateKind('srflx')).toBe('srflx')
    expect(toCandidateKind('relay')).toBe('relay')
    expect(toCandidateKind('weird')).toBe('unknown')
    expect(toCandidateKind(undefined)).toBe('unknown')
  })
})

describe('deriveConnectionHint', () => {
  it('explains each stage', () => {
    expect(
      deriveConnectionHint({ signalingReachable: false, peersDiscovered: 0, iceState: null, candidateKind: null }),
    ).toEqual({ hint: 'signaling-unreachable', recommendFileFallback: true })
    expect(
      deriveConnectionHint({ signalingReachable: true, peersDiscovered: 0, iceState: null, candidateKind: null }),
    ).toEqual({ hint: 'no-peers', recommendFileFallback: false })
    expect(
      deriveConnectionHint({
        signalingReachable: true,
        peersDiscovered: 1,
        iceState: 'connected',
        candidateKind: 'host',
      }),
    ).toEqual({ hint: 'connected-direct', recommendFileFallback: false })
    expect(
      deriveConnectionHint({
        signalingReachable: true,
        peersDiscovered: 1,
        iceState: 'connected',
        candidateKind: 'relay',
      }),
    ).toEqual({ hint: 'connected-relay', recommendFileFallback: false })
    expect(
      deriveConnectionHint({
        signalingReachable: true,
        peersDiscovered: 1,
        iceState: 'checking',
        candidateKind: null,
      }),
    ).toEqual({ hint: 'negotiating', recommendFileFallback: false })
  })

  it('recommends a relay or the file fallback when ICE fails without one', () => {
    expect(
      deriveConnectionHint({
        signalingReachable: true,
        peersDiscovered: 2,
        iceState: 'failed',
        candidateKind: 'srflx',
      }),
    ).toEqual({ hint: 'nat-blocked', recommendFileFallback: true })
    // A failed attempt that had a relay selected is not a NAT problem: the
    // relay path itself failed.
    expect(
      deriveConnectionHint({
        signalingReachable: true,
        peersDiscovered: 2,
        iceState: 'failed',
        candidateKind: 'relay',
      }),
    ).toEqual({ hint: 'relay-failed', recommendFileFallback: true })
  })
})

describe('collectSyncConnectionSnapshot', () => {
  it('reports idle without a provider', async () => {
    const snapshot = await collectSyncConnectionSnapshot({ provider: null, peerCount: 0 })
    expect(snapshot).toMatchObject({
      signalingReachable: false,
      signalingHosts: [],
      hint: 'idle',
      recommendFileFallback: false,
    })
  })

  it('reports an unreachable signaling server with its host', async () => {
    const snapshot = await collectSyncConnectionSnapshot({
      provider: makeProvider({ connected: false, signalingUrls: ['wss://signaling.example.com:4444/path'] }),
      peerCount: 0,
    })
    expect(snapshot.signalingHosts).toEqual(['signaling.example.com:4444'])
    expect(snapshot.hint).toBe('signaling-unreachable')
    expect(snapshot.recommendFileFallback).toBe(true)
  })

  it('reports a relay candidate once a peer is connected through TURN', async () => {
    const snapshot = await collectSyncConnectionSnapshot({
      provider: makeProvider({
        connected: true,
        peers: [{ iceConnectionState: 'connected', report: makeStatsReport('relay') }],
      }),
      peerCount: 1,
    })
    expect(snapshot).toMatchObject({
      signalingReachable: true,
      peersDiscovered: 1,
      iceState: 'connected',
      candidateKind: 'relay',
      hint: 'connected-relay',
    })
  })

  it('reports a failed negotiation as a blocked direct path', async () => {
    const snapshot = await collectSyncConnectionSnapshot({
      provider: makeProvider({
        connected: true,
        // A pair can be selected and then fail; the candidate type is still
        // what the browser last chose.
        peers: [{ iceConnectionState: 'failed', report: makeStatsReport('host') }],
      }),
      peerCount: 1,
    })
    expect(snapshot.candidateKind).toBe('host')
    expect(snapshot.hint).toBe('nat-blocked')
    expect(snapshot.recommendFileFallback).toBe(true)
  })

  it('still reports the ICE state when statistics cannot be read', async () => {
    const failingProvider = makeProvider({ connected: true, peers: [{ iceConnectionState: 'checking' }] })
    const room = failingProvider.room
    const connection = room?.webrtcConns.values().next().value
    if (connection === undefined) throw new Error('fixture is missing its peer connection')
    connection.peer = {
      _pc: {
        iceConnectionState: 'checking',
        getStats: async () => {
          throw new Error('connection torn down')
        },
      },
    }

    const snapshot = await collectSyncConnectionSnapshot({ provider: failingProvider, peerCount: 1 })
    expect(snapshot.iceState).toBe('checking')
    expect(snapshot.candidateKind).toBeNull()
    expect(snapshot.hint).toBe('negotiating')
  })
})
