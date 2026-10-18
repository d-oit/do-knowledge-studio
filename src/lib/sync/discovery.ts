import { logger } from '@/lib/logging/logger'

/** Subsystem tag for local peer-discovery logs. */
const log = logger.child({ area: 'sync' })

/** BroadcastChannel name used for local peer discovery. */
const DISCOVERY_CHANNEL = 'dks-discovery'
/** Interval in ms between discovery heartbeats. */
const DISCOVERY_INTERVAL = 5000
/** Time in ms before a unseen peer is considered offline. */
const PEER_TIMEOUT = 15000

/** Metadata broadcast by a discoverable peer. */
export interface PeerInfo {
  deviceId: string
  deviceName: string
  roomId: string
  lastSeen: number
  capabilities: string[]
}

type DiscoveryCallback = (peers: PeerInfo[]) => void

let broadcastChannel: BroadcastChannel | null = null
let discoveryInterval: ReturnType<typeof setInterval> | null = null
const knownPeers = new Map<string, PeerInfo>()
let localDeviceId: string = ''
let localDeviceName: string = ''
let localRoomId: string = ''
let onPeersChange: DiscoveryCallback | null = null

/** Get or generate a persistent device ID stored in localStorage. */
export function getDeviceId(): string {
  if (!localDeviceId) {
    const stored = localStorage.getItem('dks-device-id')
    if (stored) {
      localDeviceId = stored
    } else {
      localDeviceId = crypto.randomUUID()
      localStorage.setItem('dks-device-id', localDeviceId)
    }
  }
  return localDeviceId
}

/** Get the local device name from localStorage or generate a default. */
export function getDeviceName(): string {
  if (!localDeviceName) {
    const stored = localStorage.getItem('dks-device-name')
    localDeviceName = stored || `Device ${getDeviceId().slice(0, 6)}`
  }
  return localDeviceName
}

/** Persist the local device name to localStorage. */
export function setDeviceName(name: string): void {
  localDeviceName = name
  localStorage.setItem('dks-device-name', name)
}

/** Start broadcasting and receiving peer discovery heartbeats for a room. */
export function startDiscovery(roomId: string, callback: DiscoveryCallback): void {
  stopDiscovery()

  localRoomId = roomId
  onPeersChange = callback
  knownPeers.clear()

  try {
    broadcastChannel = new BroadcastChannel(DISCOVERY_CHANNEL)

    broadcastChannel.onmessage = (event: MessageEvent<PeerInfo>) => {
      const peer = event.data
      if (peer.deviceId === getDeviceId()) return

      knownPeers.set(peer.deviceId, {
        ...peer,
        lastSeen: Date.now(),
      })

      cleanupStalePeers()
      onPeersChange?.(getLocalPeers())
    }

    broadcastChannel.postMessage({
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      roomId: localRoomId,
      lastSeen: Date.now(),
      capabilities: ['sync', 'voice'],
    } satisfies PeerInfo)

    discoveryInterval = setInterval(() => {
      broadcastChannel?.postMessage({
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        roomId: localRoomId,
        lastSeen: Date.now(),
        capabilities: ['sync', 'voice'],
      } satisfies PeerInfo)

      cleanupStalePeers()
      onPeersChange?.(getLocalPeers())
    }, DISCOVERY_INTERVAL)
  } catch {
    log.warn('BroadcastChannel not supported — local discovery disabled')
  }
}

/** Stop peer discovery and clean up the BroadcastChannel. */
export function stopDiscovery(): void {
  if (discoveryInterval) {
    clearInterval(discoveryInterval)
    discoveryInterval = null
  }
  if (broadcastChannel) {
    broadcastChannel.close()
    broadcastChannel = null
  }
  knownPeers.clear()
  onPeersChange = null
}

function cleanupStalePeers(): void {
  const now = Date.now()
  for (const [id, peer] of knownPeers) {
    if (now - peer.lastSeen > PEER_TIMEOUT) {
      knownPeers.delete(id)
    }
  }
}

function getLocalPeers(): PeerInfo[] {
  return Array.from(knownPeers.values()).filter(
    (p) => p.roomId === localRoomId,
  )
}

/** Get a list of rooms with their current peer counts from discovery state. */
export function getAvailableRooms(): { roomId: string; peerCount: number }[] {
  const roomMap = new Map<string, number>()
  for (const peer of knownPeers.values()) {
    const count = roomMap.get(peer.roomId) ?? 0
    roomMap.set(peer.roomId, count + 1)
  }
  return Array.from(roomMap.entries()).map(([roomId, peerCount]) => ({
    roomId,
    peerCount,
  }))
}

/** Default signaling server URLs for WebRTC peer connection. */
const DEFAULT_SIGNALING_SERVERS = ['wss://signaling.yjs.dev']

/** Parse the shared comma-separated public signaling configuration. */
export function getSignalingServers(configured = process.env.NEXT_PUBLIC_YJS_SIGNALING_SERVERS): string[] {
  const value = configured?.trim() ? configured : DEFAULT_SIGNALING_SERVERS.join(',')
  const candidates = value.split(',')
  const unique = new Set<string>()
  for (const candidate of candidates) {
    const endpoint = candidate.trim()
    if (!endpoint) continue
    try {
      const url = new URL(endpoint)
      if (
        url.protocol === 'wss:' &&
        url.hostname &&
        url.hostname !== 'y-webrtc-signaling.herokuapp.com'
      ) unique.add(url.toString().replace(/\/$/, ''))
    } catch {
      continue
    }
  }
  return Array.from(unique)
}

/** Validated signaling endpoints shared by room joining and discovery. */
export const SIGNALING_SERVERS = getSignalingServers()
