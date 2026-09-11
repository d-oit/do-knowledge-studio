'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Wifi,
  History,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { cn } from '@/lib/utils'
import { SyncStatusCard, generateRoomId } from './sync-helpers'
import {
  initSync,
  joinRoom,
  getProvider,
  getYjsEntities,
  getYjsClaims,
  destroy,
} from '@/lib/sync'
import { useStudioStore } from '@/lib/studio/store'
import { mergeIntoYjs, applyConflictResolution } from '@/lib/sync/bridge'
import {
  startDiscovery,
  stopDiscovery,
  type PeerInfo,
} from '@/lib/sync/discovery'
import { ConflictUI } from '../conflict-ui'
import type { FieldConflict } from '@/lib/sync/merge'
import { PresenceList } from '../presence-indicator'
import { usePresence } from '@/lib/sync/use-presence'

type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
type PairingMode = 'none' | 'display' | 'scan'

interface SyncEvent {
  id: string
  type: 'join' | 'leave' | 'sync' | 'error'
  message: string
  timestamp: number
}

interface SyncProviderEventHandlers {
  addEvent: (type: SyncEvent['type'], message: string) => void
  setStatus: (status: SyncStatus) => void
  setSyncedEntities: (count: number) => void
  setSyncedClaims: (count: number) => void
  setPeerCount: (count: number) => void
}

/**
 * Subscribes to the active provider's `synced`, `status`, and `peers` events and folds them
 * into view state. Extracted from `SyncView` to keep that component under the DeepSource
 * JS-R1005 complexity ceiling; every handler passed in is a stable setter or `useCallback`,
 * so the subscription is established once rather than re-bound on each render.
 */
const useSyncProviderEvents = ({
  addEvent,
  setStatus,
  setSyncedEntities,
  setSyncedClaims,
  setPeerCount,
}: SyncProviderEventHandlers): void => {
  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    const handleSynced = () => {
      setStatus('connected')
      setSyncedEntities(getYjsEntities().length)
      setSyncedClaims(getYjsClaims().length)
      addEvent('sync', 'Document synchronized')
    }

    const handleStatus = (data: { connected: boolean }) => {
      if (data.connected) {
        setStatus('connected')
        addEvent('join', 'Connected to signaling server')
      } else {
        setStatus('disconnected')
        addEvent('leave', 'Disconnected from signaling server')
      }
    }

    const handlePeers = (data: { webrtcPeers: string[]; bcPeers: string[] }) => {
      setPeerCount(data.webrtcPeers.length + data.bcPeers.length)
    }

    provider.on('synced', handleSynced)
    provider.on('status', handleStatus)
    provider.on('peers', handlePeers)

    return () => {
      provider.off('synced', handleSynced)
      provider.off('status', handleStatus)
      provider.off('peers', handlePeers)
    }
  }, [addEvent, setStatus, setSyncedEntities, setSyncedClaims, setPeerCount])
}

/**
 * Starts LAN peer discovery while the room is connected and tears it down on cleanup.
 * Extracted from `SyncView` for the same JS-R1005 reason as `useSyncProviderEvents`.
 */
const useRoomDiscovery = (
  status: SyncStatus,
  roomId: string,
  setDiscoveredPeers: (peers: PeerInfo[]) => void,
): void => {
  useEffect(() => {
    if (status !== 'connected' || !roomId) return
    startDiscovery(roomId, (peers) => {
      setDiscoveredPeers(peers)
    })
    return () => {
      stopDiscovery()
    }
  }, [status, roomId, setDiscoveredPeers])
}

/** Maps a sync event type to its status-dot colour. */
const eventDotClass = (type: SyncEvent['type']): string => {
  switch (type) {
    case 'join':
      return 'bg-emerald-500'
    case 'leave':
      return 'bg-ink-faint'
    case 'sync':
      return 'bg-saffron'
    case 'error':
      return 'bg-red-500'
  }
}

/** Page header for the sync view. */
const SyncHeader = ({ reducedMotion }: { reducedMotion: boolean }) => (
  <motion.div
    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={reducedMotion ? { duration: 0 } : undefined}
    className="mb-6 flex items-start gap-4"
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sage to-emerald-600 text-white shadow-sm">
      <Wifi className="h-6 w-6" />
    </div>
    <div className="flex-1">
      <h1 className="font-serif text-2xl font-semibold text-ink">Sync</h1>
      <p className="text-[13px] text-ink-mute">
        Connect devices and sync your knowledge base peer-to-peer.
      </p>
    </div>
  </motion.div>
)

/** Conflict-resolution card, rendered only while conflicts are pending. */
const ConflictSection = ({
  conflicts,
  onResolve,
  onDismiss,
  reducedMotion,
}: {
  conflicts: FieldConflict[]
  onResolve: (resolutions: Map<string, 'local' | 'remote'>) => void
  onDismiss: () => void
  reducedMotion: boolean
}) => {
  if (conflicts.length === 0) return null
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="mb-6"
    >
      <ConflictUI conflicts={conflicts} onResolve={onResolve} onDismiss={onDismiss} />
    </motion.div>
  )
}

/** Chronological list of sync events. */
const SyncHistoryCard = ({ events }: { events: SyncEvent[] }) => (
  <div className="rounded-lg border border-border bg-card p-5">
    <h2 className="mb-3 font-serif text-[15px] font-semibold text-ink">
      <History className="mr-1.5 inline h-4 w-4" />
      Sync History
    </h2>
    {events.length === 0 ? (
      <p className="text-[13px] text-ink-faint">No sync events yet.</p>
    ) : (
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2"
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', eventDotClass(event.type))} />
            <span className="flex-1 text-[13px] text-ink">{event.message}</span>
            <span className="text-caption text-ink-faint">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
)

/** Online collaborators card, rendered only when peers are present. */
const OnlineUsersCard = ({ visible }: { visible: boolean }) => {
  if (!visible) return null
  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 font-serif text-[15px] font-semibold text-ink">
        <Users className="mr-1.5 inline h-4 w-4" />
        Online Users
      </h2>
      <PresenceList />
    </div>
  )
}

/** Peer-to-peer sync view with room management, QR pairing, conflict resolution, and presence. */
// Arrow form, not `function`: DeepSource flags top-level function declarations in modules
// as global-scope declarations (JS-0067), and the repo convention is `const fn = () => {}`.
export const SyncView = () => {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const { peers: presencePeers } = usePresence()
  const [status, setStatus] = useState<SyncStatus>('disconnected')
  const [roomId, setRoomId] = useState('')
  const [inputRoomId, setInputRoomId] = useState('')
  // Held in component state only — never persisted, logged, or added to the event history.
  const [roomPassword, setRoomPassword] = useState('')
  const [peerCount, setPeerCount] = useState(0)
  const [events, setEvents] = useState<SyncEvent[]>([])
  const [syncedEntities, setSyncedEntities] = useState(0)
  const [syncedClaims, setSyncedClaims] = useState(0)
  const [pairingMode, setPairingMode] = useState<PairingMode>('none')
  const [discoveredPeers, setDiscoveredPeers] = useState<PeerInfo[]>([])
  const [pendingConflicts, setPendingConflicts] = useState<FieldConflict[]>([])
  const reducedMotion = useReducedMotion()

  const addEvent = useCallback(
    (type: SyncEvent['type'], message: string) => {
      setEvents((prev) => [
        { id: crypto.randomUUID(), type, message, timestamp: Date.now() },
        ...prev.slice(0, 49),
      ])
    },
    [],
  )

  useEffect(() => {
    initSync().catch(() => {
      addEvent('error', 'Failed to initialize sync storage')
    })
  }, [addEvent])

  useSyncProviderEvents({ addEvent, setStatus, setSyncedEntities, setSyncedClaims, setPeerCount })
  useRoomDiscovery(status, roomId, setDiscoveredPeers)

  const handleJoin = useCallback(() => {
    const id = inputRoomId.trim() || generateRoomId()
    // A blank password means "no encryption": omit the option entirely so the unencrypted
    // path stays identical instead of passing an empty-string secret to y-webrtc.
    const password = roomPassword.trim()
    setStatus('connecting')
    addEvent('join', `Joining room ${id}…`)

    try {
      // Call through with no second argument when unencrypted, so the existing code path
      // (and its arity) is untouched.
      if (password) {
        joinRoom(id, { password })
      } else {
        joinRoom(id)
      }
      setRoomId(id)
      setInputRoomId('')
      setRoomPassword('')

      mergeIntoYjs(entities, claims)
      addEvent('sync', `Merged ${entities.length} entities, ${claims.length} claims`)
      toast.success(`Joined room ${id}`)
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Unknown error'
      addEvent('error', `Failed to join: ${msg}`)
      toast.error(`Failed to join room: ${msg}`)
    }
  }, [inputRoomId, roomPassword, entities, claims, addEvent])

  const handleLeave = useCallback(() => {
    stopDiscovery()
    destroy()
    setStatus('disconnected')
    setRoomId('')
    setPeerCount(0)
    setDiscoveredPeers([])
    setRoomPassword('')
    addEvent('leave', 'Left sync room')
    toast.info('Left sync room')
  }, [addEvent])

  const handleResync = useCallback(() => {
    const result = mergeIntoYjs(entities, claims)
    setSyncedEntities(getYjsEntities().length)
    setSyncedClaims(getYjsClaims().length)
    if (result.conflicts.length > 0) {
      setPendingConflicts(result.conflicts)
      addEvent('sync', `Found ${result.conflicts.length} conflict(s) requiring resolution`)
    } else {
      addEvent('sync', `Re-synced ${entities.length} entities, ${claims.length} claims`)
      toast.success('Re-synced local data')
    }
  }, [entities, claims, addEvent])

  const handleConflictResolve = useCallback((resolutions: Map<string, 'local' | 'remote'>) => {
    const resolvedConflicts = [...pendingConflicts]
    applyConflictResolution(resolutions, resolvedConflicts, entities, claims)
    setPendingConflicts([])
    addEvent('sync', `Applied ${resolutions.size} conflict resolution(s)`)
    toast.success(`Applied ${resolutions.size} conflict resolution(s)`)
  }, [pendingConflicts, entities, claims, addEvent])

  const handleConflictDismiss = useCallback(() => {
    setPendingConflicts([])
  }, [])

  const handleQrScan = useCallback((scannedRoomId: string) => {
    setInputRoomId(scannedRoomId)
    setPairingMode('none')
    toast.info(`Scanned room: ${scannedRoomId}`)
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-10 lg:py-8">
      <SyncHeader reducedMotion={reducedMotion} />

      <SyncStatusCard
        status={status}
        roomId={roomId}
        inputRoomId={inputRoomId}
        onInputChange={setInputRoomId}
        inputPassword={roomPassword}
        onPasswordChange={setRoomPassword}
        onJoin={handleJoin}
        peerCount={peerCount}
        syncedEntities={syncedEntities}
        syncedClaims={syncedClaims}
        pairingMode={pairingMode}
        onPairingModeChange={setPairingMode}
        discoveredPeers={discoveredPeers}
        onResync={handleResync}
        onLeave={handleLeave}
        onQrScan={handleQrScan}
      />

      <ConflictSection
        conflicts={pendingConflicts}
        onResolve={handleConflictResolve}
        onDismiss={handleConflictDismiss}
        reducedMotion={reducedMotion}
      />

      <SyncHistoryCard events={events} />

      <OnlineUsersCard visible={presencePeers.length > 0} />
    </div>
  )
}
