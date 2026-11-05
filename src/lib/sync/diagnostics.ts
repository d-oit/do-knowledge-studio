/**
 * Connection diagnostics for peer-to-peer rooms (#1052).
 *
 * The room status badge answers "is there a room?"; it cannot answer "why is
 * there no peer?". This module reads the stages of a connection — signaling,
 * peer discovery, ICE negotiation, and the candidate type that carried the
 * media — and turns them into one snapshot the Sync view can explain in plain
 * language, with GFM-free hints (see `plans/200-ice-turn-diagnostics-1052`).
 *
 * Nothing here logs or returns a credential: signaling hosts are host:port,
 * and candidate types are opaque browser labels.
 */
import { logger } from '@/lib/logging/logger'
import type { RoomProvider } from './doc'

const log = logger.child({ area: 'sync' })

/** Local link to the self-hosting guide, shown when signaling is unreachable. */
export const SYNC_SELF_HOSTING_DOC_URL =
  'https://github.com/d-o-it/do-knowledge-studio/blob/main/docs/sync-self-hosting.md'

/** Candidate kinds `RTCIceCandidateStats.candidateType` can report. */
export type IceCandidateKind = 'host' | 'srflx' | 'prflx' | 'relay' | 'unknown'

/** Plain-language reason behind the current connection state. */
export type SyncConnectionHint =
  | 'idle'
  | 'signaling-unreachable'
  | 'no-peers'
  | 'negotiating'
  | 'connected-direct'
  | 'connected-relay'
  | 'nat-blocked'
  | 'relay-failed'

/** One read-only view of the connection pipeline. */
export interface SyncConnectionSnapshot {
  /** Whether the provider holds an open signaling connection. */
  signalingReachable: boolean
  /** Signaling servers as `host:port`, never the full URL with any query. */
  signalingHosts: string[]
  /** Peers the provider currently knows about (announced or connected). */
  peersDiscovered: number
  /** ICE connection state of the first peer connection, when negotiating. */
  iceState: RTCIceConnectionState | null
  /** Candidate type that carried the connection, when one is selected. */
  candidateKind: IceCandidateKind | null
  hint: SyncConnectionHint
  /** Whether the file-based fallback is the recommended recovery. */
  recommendFileFallback: boolean
}

/** Everything the snapshot is derived from. */
export interface SyncConnectionInput {
  provider: RoomProvider | null
  peerCount: number
}

/** simple-peer exposes its RTCPeerConnection as `_pc`; y-webrtc does not type it. */
interface PeerConnectionCarrier {
  _pc?: RTCPeerConnection
}

/** Narrow enough of a stats report to read the selected candidate pair. */
interface CandidatePairReport {
  type: RTCStatsType
  state?: string
  nominated?: boolean
  selected?: boolean
  localCandidateId?: string
}

/** Narrow enough of a stats report to read a candidate type. */
interface CandidateReport {
  type: RTCStatsType
  candidateType?: string
}

/** Candidate types the browser may report, mapped to our union. */
const CANDIDATE_KINDS: Record<string, IceCandidateKind> = {
  host: 'host',
  srflx: 'srflx',
  prflx: 'prflx',
  relay: 'relay',
}

/** ICE states that mean negotiation will not recover on its own. */
const FAILED_ICE_STATES: readonly RTCIceConnectionState[] = ['failed', 'disconnected', 'closed']

/** Maps an opaque browser candidate type onto the union, defaulting to unknown. */
export const toCandidateKind = (candidateType: string | undefined): IceCandidateKind =>
  candidateType === undefined ? 'unknown' : (CANDIDATE_KINDS[candidateType] ?? 'unknown')

/** Host:port for each signaling URL; a malformed entry is skipped, not thrown. */
const toSignalingHosts = (urls: readonly string[]): string[] => {
  const hosts: string[] = []
  for (const url of urls) {
    try {
      const parsed = new URL(url)
      hosts.push(parsed.port === '' ? parsed.hostname : `${parsed.hostname}:${parsed.port}`)
    } catch {
      // A signaling URL y-webrtc accepted but `URL` rejects would have crashed
      // the provider already; displaying nothing beats displaying nonsense.
      hosts.push('')
    }
  }
  return hosts.filter((host) => host !== '')
}

/** The peer connections backing the room's data channels. */
const getPeerConnections = (provider: RoomProvider): RTCPeerConnection[] => {
  const connections = provider.room?.webrtcConns
  if (connections === undefined) return []
  const peerConnections: RTCPeerConnection[] = []
  for (const connection of connections.values()) {
    const peer: unknown = connection.peer
    const pc = (peer as PeerConnectionCarrier | null)?._pc
    if (pc !== undefined) peerConnections.push(pc)
  }
  return peerConnections
}

/** Reads the selected candidate pair of one peer connection. */
const readSelectedCandidate = async (
  pc: RTCPeerConnection,
): Promise<{ state: RTCIceConnectionState; kind: IceCandidateKind | null }> => {
  const state = pc.iceConnectionState
  try {
    const report = await pc.getStats()
    const selectedPairs: CandidatePairReport[] = []
    // Collected into an array rather than assigned in the callback: TypeScript
    // narrows a `let` assigned only inside `forEach` to `never` afterwards.
    report.forEach((entry: RTCStats) => {
      const candidate = entry as unknown as CandidatePairReport
      if (
        candidate.type === 'candidate-pair' &&
        candidate.state === 'succeeded' &&
        (candidate.selected === true || candidate.nominated === true)
      ) {
        selectedPairs.push(candidate)
      }
    })
    const localCandidateId: string | undefined = selectedPairs.at(-1)?.localCandidateId
    if (localCandidateId === undefined) return { state, kind: null }
    const localCandidate = report.get(localCandidateId) as unknown as CandidateReport | undefined
    return { state, kind: toCandidateKind(localCandidate?.candidateType) }
  } catch (error) {
    // `getStats` can reject while a connection is tearing down; the ICE state
    // read above is still useful, so report it without a candidate type.
    log.warn('Could not read ICE statistics for the sync room', { error })
    return { state, kind: null }
  }
}

/** Aggregates negotiation facts across every peer connection. */
const readNegotiation = async (
  peerConnections: readonly RTCPeerConnection[],
): Promise<{ iceState: RTCIceConnectionState | null; candidateKind: IceCandidateKind | null }> => {
  const samples = await Promise.all(peerConnections.map(readSelectedCandidate))
  const failedState = samples.find((sample) => FAILED_ICE_STATES.includes(sample.state))
  const relay = samples.find((sample) => sample.kind === 'relay')
  const kind = relay?.kind ?? samples.find((sample) => sample.kind !== null)?.kind ?? null
  return { iceState: failedState?.state ?? samples[0]?.state ?? null, candidateKind: kind }
}

/** Picks the plain-language explanation for a snapshot's stages. */
export const deriveConnectionHint = (
  snapshot: Pick<
    SyncConnectionSnapshot,
    'signalingReachable' | 'peersDiscovered' | 'iceState' | 'candidateKind'
  >,
): { hint: SyncConnectionHint; recommendFileFallback: boolean } => {
  if (!snapshot.signalingReachable) return { hint: 'signaling-unreachable', recommendFileFallback: true }
  if (snapshot.peersDiscovered === 0) return { hint: 'no-peers', recommendFileFallback: false }
  const iceFailed =
    snapshot.iceState !== null && FAILED_ICE_STATES.includes(snapshot.iceState)
  if (iceFailed) {
    // Peers were found, so signaling works; the media path is what failed. A
    // failed attempt that had a relay selected is not a NAT problem: the relay
    // itself (or its credential) is what needs checking.
    return {
      hint: snapshot.candidateKind === 'relay' ? 'relay-failed' : 'nat-blocked',
      recommendFileFallback: true,
    }
  }
  if (snapshot.candidateKind === 'relay') return { hint: 'connected-relay', recommendFileFallback: false }
  if (snapshot.candidateKind === 'host' || snapshot.candidateKind === 'srflx') {
    return { hint: 'connected-direct', recommendFileFallback: false }
  }
  return { hint: 'negotiating', recommendFileFallback: false }
}

/** The snapshot before any ICE statistics have been read. */
const IDLE_SNAPSHOT: SyncConnectionSnapshot = {
  signalingReachable: false,
  signalingHosts: [],
  peersDiscovered: 0,
  iceState: null,
  candidateKind: null,
  hint: 'idle',
  recommendFileFallback: false,
}

/**
 * Stages that can be read without touching `RTCPeerConnection`.
 *
 * The Sync view renders this synchronously from its current props and merges
 * {@link readNegotiationSample} in when it arrives, so a peer-count change never
 * waits on an async `getStats()` call.
 */
export const deriveStagesSnapshot = (input: SyncConnectionInput): SyncConnectionSnapshot => {
  const { provider, peerCount } = input
  if (provider === null) return IDLE_SNAPSHOT
  const stages = {
    signalingReachable: provider.connected,
    peersDiscovered: peerCount,
    iceState: null,
    candidateKind: null,
  }
  const { hint, recommendFileFallback } = deriveConnectionHint(stages)
  return {
    ...stages,
    signalingHosts: toSignalingHosts(provider.signalingUrls ?? []),
    hint,
    recommendFileFallback,
  }
}

/** ICE facts read from the room's peer connections. */
export interface NegotiationSample {
  iceState: RTCIceConnectionState | null
  candidateKind: IceCandidateKind | null
}

/** Reads ICE statistics; `null` only when there is no provider to read. */
export const readNegotiationSample = async (
  provider: RoomProvider | null,
): Promise<NegotiationSample | null> => {
  if (provider === null) return null
  return readNegotiation(getPeerConnections(provider))
}

/** Folds ICE statistics into a stages snapshot, recomputing the hint. */
export const mergeNegotiation = (
  snapshot: SyncConnectionSnapshot,
  sample: NegotiationSample | null,
): SyncConnectionSnapshot => {
  if (sample === null) return snapshot
  const stages = {
    signalingReachable: snapshot.signalingReachable,
    peersDiscovered: snapshot.peersDiscovered,
    iceState: sample.iceState,
    candidateKind: sample.candidateKind,
  }
  const { hint, recommendFileFallback } = deriveConnectionHint(stages)
  return { ...snapshot, ...stages, hint, recommendFileFallback }
}

/** Collects one diagnostics snapshot; never rejects. */
export const collectSyncConnectionSnapshot = async (
  input: SyncConnectionInput,
): Promise<SyncConnectionSnapshot> =>
  mergeNegotiation(deriveStagesSnapshot(input), await readNegotiationSample(input.provider))
