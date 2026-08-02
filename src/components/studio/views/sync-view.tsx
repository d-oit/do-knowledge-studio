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

export function SyncView() {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const { peers: presencePeers } = usePresence()
  const [status, setStatus] = useState<SyncStatus>('disconnected')
  const [roomId, setRoomId] = useState('')
  const [inputRoomId, setInputRoomId] = useState('')
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
  }, [addEvent])

  useEffect(() => {
    if (status === 'connected' && roomId) {
      startDiscovery(roomId, (peers) => {
        setDiscoveredPeers(peers)
      })
      return () => { stopDiscovery() }
    }
  }, [status, roomId])

  const handleJoin = useCallback(async () => {
    const id = inputRoomId.trim() || generateRoomId()
    setStatus('connecting')
    addEvent('join', `Joining room ${id}…`)

    try {
      joinRoom(id)
      setRoomId(id)
      setInputRoomId('')

      mergeIntoYjs(entities, claims)
      addEvent('sync', `Merged ${entities.length} entities, ${claims.length} claims`)
      toast.success(`Joined room ${id}`)
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Unknown error'
      addEvent('error', `Failed to join: ${msg}`)
      toast.error(`Failed to join room: ${msg}`)
    }
  }, [inputRoomId, entities, claims, addEvent])

  const handleLeave = useCallback(() => {
    stopDiscovery()
    destroy()
    setStatus('disconnected')
    setRoomId('')
    setPeerCount(0)
    setDiscoveredPeers([])
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

      <SyncStatusCard
        status={status}
        roomId={roomId}
        inputRoomId={inputRoomId}
        onInputChange={setInputRoomId}
        onJoin={() => void handleJoin()}
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

      {/* Conflict Resolution */}
      {pendingConflicts.length > 0 && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : undefined}
          className="mb-6"
        >
          <ConflictUI
            conflicts={pendingConflicts}
            onResolve={handleConflictResolve}
            onDismiss={handleConflictDismiss}
          />
        </motion.div>
      )}

      {/* Sync History */}
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
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    event.type === 'join' && 'bg-emerald-500',
                    event.type === 'leave' && 'bg-ink-faint',
                    event.type === 'sync' && 'bg-saffron',
                    event.type === 'error' && 'bg-red-500',
                  )}
                />
                <span className="flex-1 text-[13px] text-ink">{event.message}</span>
                <span className="text-caption text-ink-faint">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Online Users */}
      {presencePeers.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 font-serif text-[15px] font-semibold text-ink">
            <Users className="mr-1.5 inline h-4 w-4" />
            Online Users
          </h2>
          <PresenceList />
        </div>
      )}
    </div>
  )
}
