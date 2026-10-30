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
import { SyncStatusCard, generateRoomId, type SyncStatus } from './sync-helpers'
import {
  initSync,
  joinRoom,
  getProvider,
  getYjsEntities,
  getYjsClaims,
  leaveRoom,
  ensurePersistenceReady,
} from '@/lib/sync'
import type { RoomProvider } from '@/lib/sync'
import { useStudioStore } from '@/lib/studio/store'
import { mergeIntoYjs, applyConflictResolution, commitMergedState, subscribeSyncConflicts } from '@/lib/sync/bridge'
import {
  startDiscovery,
  stopDiscovery,
  type PeerInfo,
} from '@/lib/sync/discovery'
import { ConflictUI } from '../conflict-ui'
import { ViewHeader, VIEW_CONTAINER_CLASS } from '../ui/shared-primitives'
import { getConflictResolutionKey, type FieldConflict } from '@/lib/sync/merge'
import { PresenceList } from '../presence-indicator'
import { usePresence } from '@/lib/sync/use-presence'
import { translate as t } from '@/lib/i18n/messages/sync'
import { translate as navT } from '@/lib/i18n/messages/nav'

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
const useSyncProviderEvents = (
  provider: RoomProvider | null,
  { addEvent, setStatus, setSyncedEntities, setSyncedClaims, setPeerCount }: SyncProviderEventHandlers,
): void => {
  useEffect(() => {
    if (!provider) return
    const handleSynced = () => {
      setStatus('connected')
      setSyncedEntities(getYjsEntities().length)
      setSyncedClaims(getYjsClaims().length)
      addEvent('sync', t('sync.event.synced'))
    }

    const handleStatus = (data: { connected: boolean }) => {
      if (data.connected) {
        setStatus('connected')
        addEvent('join', t('sync.event.connected'))
      } else {
        setStatus('disconnected')
        addEvent('leave', t('sync.event.disconnected'))
      }
    }

    const handlePeers = (data: { webrtcPeers: string[]; bcPeers: string[] }) => {
      const count = data.webrtcPeers.length + data.bcPeers.length
      setPeerCount(count)
      if (count > 0) {
        setStatus('peer-connected')
      } else if (provider.connected) {
        setStatus('room-active')
      }
    }

    provider.on('synced', handleSynced)
    provider.on('status', handleStatus)
    provider.on('peers', handlePeers)

    return () => {
      provider.off('synced', handleSynced)
      provider.off('status', handleStatus)
      provider.off('peers', handlePeers)
    }
  }, [provider, addEvent, setStatus, setSyncedEntities, setSyncedClaims, setPeerCount])
}

/**
 * Starts LAN peer discovery while the room is active and tears it down on cleanup.
 * Extracted from `SyncView` for the same JS-R1005 reason as `useSyncProviderEvents`.
 */
const useRoomDiscovery = (
  status: SyncStatus,
  roomId: string,
  setDiscoveredPeers: (peers: PeerInfo[]) => void,
): void => {
  useEffect(() => {
    // A single guarded branch rather than an early bare `return` plus a value return:
    // mixing those makes the callback's return paths inconsistent, which is what
    // DeepSource's JS-0045 consistent-return rule reports.
    if (status === 'connected' && roomId) {
      startDiscovery(roomId, (peers) => {
        setDiscoveredPeers(peers)
      })
      // Returned directly: `stopDiscovery` takes no arguments and returns void, so it is
      // already a valid cleanup with no wrapper arrow needed.
      return stopDiscovery
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
    default:
      return 'bg-ink-faint'
  }
}

/** Page header for the sync view. */
const SyncHeader = ({ reducedMotion }: { reducedMotion: boolean }) => (
  <motion.div
    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={reducedMotion ? { duration: 0 } : undefined}
  >
    <ViewHeader icon={Wifi} title={navT('nav.sync.title')} subtitle={t('sync.subtitle')} />
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
  <div className="rounded-lg border border-border bg-card p-5">      <h2 className="mb-3 font-serif text-body-lg font-semibold text-ink">
        <History className="mr-1.5 inline h-4 w-4" />
        {t('sync.history.title')}
      </h2>
      {events.length === 0 ? (
        <p className="text-body-sm text-ink-faint">{t('sync.history.empty')}</p>
    ) : (
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2"
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', eventDotClass(event.type))} />
            <span className="flex-1 text-body-sm text-ink">{event.message}</span>
            <span className="text-caption text-ink-faint">
              {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(event.timestamp))}
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
    <div className="mt-6 rounded-lg border border-border bg-card p-5">        <h2 className="mb-3 font-serif text-body-lg font-semibold text-ink">
          <Users className="mr-1.5 inline h-4 w-4" />
          {t('sync.onlineUsers')}
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
  const [provider, setProvider] = useState(() => getProvider())
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
      addEvent('error', t('sync.event.initFailed'))
    })
  }, [addEvent])

  useSyncProviderEvents(provider, { addEvent, setStatus, setSyncedEntities, setSyncedClaims, setPeerCount })
  useEffect(() => {
    if (status !== 'connected') return
    setSyncedEntities(entities.length)
    setSyncedClaims(claims.length)
  }, [status, entities.length, claims.length])

  useRoomDiscovery(status, roomId, setDiscoveredPeers)
  useEffect(() => subscribeSyncConflicts((conflicts) => {
    setPendingConflicts((previous) => {
      const next = new Map(previous.map((conflict) => [getConflictResolutionKey(conflict), conflict]))
      for (const conflict of conflicts) next.set(getConflictResolutionKey(conflict), conflict)
      return Array.from(next.values())
    })
  }), [])

  const handleJoin = useCallback(() => {
    const id = inputRoomId.trim() || generateRoomId()
    setPendingConflicts([])
    // A blank password means "no encryption": omit the option entirely so the unencrypted
    // path stays identical instead of passing an empty-string secret to y-webrtc.
    const password = roomPassword.trim()
    setStatus('joining')
    addEvent('join', t('sync.event.joining', id))

    try {
      void ensurePersistenceReady()
      const newProvider = password ? joinRoom(id, { password }) : joinRoom(id)
      setProvider(newProvider)
      setRoomId(id)
      setInputRoomId('')
      setRoomPassword('')

      const result = mergeIntoYjs(entities, claims)
      if (!commitMergedState(result.merged.entities, result.merged.claims)) {
        throw new Error('The sync merge contained invalid records.')
      }
      setPendingConflicts(result.conflicts)
      if (result.conflicts.length > 0) {
        setStatus('conflict')
        addEvent('sync', t('sync.event.conflictsFound', String(result.conflicts.length)))
        } else if (newProvider.connected) {
        setStatus('room-active')
        addEvent('sync', t(
          'sync.event.merged',
          String(result.merged.entities.length),
          String(result.merged.claims.length),
        ))
        } else {
          addEvent('sync', t(
            'sync.event.merged',
            String(result.merged.entities.length),
            String(result.merged.claims.length),
          ))
      }
      toast.success(t('sync.toast.joined', id))
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : t('sync.error.unknown')
      addEvent('error', t('sync.event.joinFailed', msg))
      toast.error(t('sync.toast.joinFailed', msg))
    }
  }, [inputRoomId, roomPassword, entities, claims, addEvent])

  const handleLeave = useCallback(() => {
    setStatus('leaving')
    stopDiscovery()
    leaveRoom()
    setPendingConflicts([])
    setProvider(null)
    setStatus('idle')
    setRoomId('')
    setPeerCount(0)
    setDiscoveredPeers([])
    setRoomPassword('')
    addEvent('leave', t('sync.event.left'))
    toast.info(t('sync.toast.left'))
  }, [addEvent])

  const handleResync = useCallback(() => {
    const result = mergeIntoYjs(entities, claims)
    if (!commitMergedState(result.merged.entities, result.merged.claims)) {
      addEvent('error', t('sync.event.conflictApplyFailed'))
      return
    }
    setPendingConflicts(result.conflicts)
    setSyncedEntities(getYjsEntities().length)
    setSyncedClaims(getYjsClaims().length)
    if (result.conflicts.length > 0) {
      addEvent('sync', t('sync.event.conflictsFound', String(result.conflicts.length)))
    } else {
      addEvent('sync', t(
        'sync.event.resynced',
        String(result.merged.entities.length),
        String(result.merged.claims.length),
      ))
      toast.success(t('sync.toast.resynced'))
    }
  }, [entities, claims, addEvent])

  const handleConflictResolve = useCallback((resolutions: Map<string, 'local' | 'remote'>) => {
    const resolvedConflicts = [...pendingConflicts]
    if (!applyConflictResolution(resolutions, resolvedConflicts, entities, claims)) {
      addEvent('error', t('sync.event.conflictApplyFailed'))
      return
    }
    setPendingConflicts([])
    addEvent('sync', t('sync.event.conflictApplied', String(resolutions.size)))
    toast.success(t('sync.toast.conflictApplied', String(resolutions.size)))
  }, [pendingConflicts, entities, claims, addEvent])

  const handleConflictDismiss = useCallback(() => {
    setPendingConflicts([])
  }, [])

  const handleQrScan = useCallback((scannedRoomId: string) => {
    setInputRoomId(scannedRoomId)
    setPairingMode('none')
    toast.info(t('sync.toast.scannedRoom', scannedRoomId))
  }, [])

  return (
    <div className={cn(VIEW_CONTAINER_CLASS, 'max-w-3xl')}>
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
