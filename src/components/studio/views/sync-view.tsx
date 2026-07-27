'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Wifi,
  WifiOff,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  History,
  Loader2,
  QrCode,
  Camera,
  Radio,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import {
  initSync,
  joinRoom,
  getProvider,
  getYjsEntities,
  getYjsClaims,
  destroy,
} from '@/lib/sync'
import { useStudioStore } from '@/lib/studio/store'
import { mergeIntoYjs } from '@/lib/sync/bridge'
import { QRDisplay, QRScanner } from '../qr-pairing'
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

function generateRoomId(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10)
}

export function SyncView() {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const { peers: presencePeers } = usePresence()
  const [status, setStatus] = useState<SyncStatus>('disconnected')
  const [roomId, setRoomId] = useState('')
  const [inputRoomId, setInputRoomId] = useState('')
  const [peerCount, setPeerCount] = useState(0)
  const [copied, setCopied] = useState(false)
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

  const handleCopyRoomId = useCallback(() => {
    if (!roomId) return
    void navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2000)
  }, [roomId])

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

  const handleConflictResolve = useCallback((_resolutions: Map<string, 'local' | 'remote'>) => {
    setPendingConflicts([])
    addEvent('sync', 'Conflicts resolved by user')
    toast.success('Conflicts resolved')
  }, [addEvent])

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

      {/* Status Card */}
      <div className="mb-6 rounded-lg border border-border bg-card p-5" aria-live="polite">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-[15px] font-semibold text-ink">Connection</h2>
          <div className="flex items-center gap-2">
            {status === 'connected' ? (
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Connected
              </span>
            ) : status === 'connecting' ? (
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-saffron">
                <Loader2 className="h-3 w-3 animate-spin" />
                Connecting
              </span>
            ) : status === 'error' ? (
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-red-500">
                <WifiOff className="h-3 w-3" />
                Error
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-faint">
                <WifiOff className="h-3 w-3" />
                Disconnected
              </span>
            )}
          </div>
        </div>

        {status === 'disconnected' ? (
          <div className="space-y-4">
            {/* QR Pairing Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { setPairingMode(pairingMode === 'display' ? 'none' : 'display') }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-[12px] font-medium transition-colors focus-ring min-h-[44px]',
                  pairingMode === 'display'
                    ? 'border-saffron bg-saffron/10 text-saffron-deep'
                    : 'border-border bg-background text-ink-soft hover:border-saffron/40',
                )}
              >
                <QrCode className="h-4 w-4" />
                Show QR Code
              </button>
              <button
                onClick={() => { setPairingMode(pairingMode === 'scan' ? 'none' : 'scan') }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-[12px] font-medium transition-colors focus-ring min-h-[44px]',
                  pairingMode === 'scan'
                    ? 'border-saffron bg-saffron/10 text-saffron-deep'
                    : 'border-border bg-background text-ink-soft hover:border-saffron/40',
                )}
              >
                <Camera className="h-4 w-4" />
                Scan QR Code
              </button>
            </div>

            {/* QR Display */}
            {pairingMode === 'display' && (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
                transition={reducedMotion ? { duration: 0 } : undefined}
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <QRDisplay roomId={roomId || generateRoomId()} />
                </div>
              </motion.div>
            )}

            {/* QR Scanner */}
            {pairingMode === 'scan' && (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
                transition={reducedMotion ? { duration: 0 } : undefined}
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <QRScanner onScan={handleQrScan} />
                </div>
              </motion.div>
            )}

            {/* Manual Input */}
            <div>
              <label htmlFor="sync-room-id" className="mb-1.5 text-label font-semibold uppercase tracking-wide text-ink-faint">
                Room ID
              </label>
              <div className="flex gap-2">
                <input
                  id="sync-room-id"
                  type="text"
                  value={inputRoomId}
                  onChange={(e) => { setInputRoomId(e.target.value) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleJoin() }}
                  placeholder="Enter room ID or leave empty to create"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                />
                <button
                  onClick={() => void handleJoin()}
                  className="rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring min-h-[44px]"
                >
                  Join
                </button>
              </div>
            </div>
            <p className="text-caption text-ink-faint">
              Share the room ID or QR code with another device to start syncing. Both devices must be online simultaneously for initial connection.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <div>
                <div className="text-[12px] font-medium text-ink">Room</div>
                <div className="font-mono text-[13px] text-ink-soft">{roomId}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPairingMode(pairingMode === 'display' ? 'none' : 'display') }}
                  className={cn(
                    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors focus-ring',
                    pairingMode === 'display'
                      ? 'bg-saffron/20 text-saffron-deep'
                      : 'text-ink-faint hover:bg-border hover:text-ink',
                  )}
                  aria-label="Show QR code"
                >
                  <QrCode className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleCopyRoomId}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-border hover:text-ink focus-ring"
                  aria-label="Copy room ID"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* QR Display when connected */}
            {pairingMode === 'display' && (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
                transition={reducedMotion ? { duration: 0 } : undefined}
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <QRDisplay roomId={roomId} />
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
                <div className="text-[12px] text-ink-faint">Peers</div>
                <div className="font-mono text-[15px] font-semibold text-ink">{peerCount}</div>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
                <div className="text-[12px] text-ink-faint">Entities</div>
                <div className="font-mono text-[15px] font-semibold text-ink">{syncedEntities}</div>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
                <div className="text-[12px] text-ink-faint">Claims</div>
                <div className="font-mono text-[15px] font-semibold text-ink">{syncedClaims}</div>
              </div>
            </div>

            {/* Discovered Peers */}
            {discoveredPeers.length > 0 && (
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                  <Radio className="h-3 w-3 text-emerald-500" />
                  Local Network Peers
                </div>
                <div className="space-y-1">
                  {discoveredPeers.map((peer) => (
                    <div
                      key={peer.deviceId}
                      className="flex items-center justify-between text-[12px]"
                    >
                      <span className="text-ink-soft">{peer.deviceName}</span>
                      <span className="text-caption text-ink-faint">
                        {peer.capabilities.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleResync}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring min-h-[44px]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-sync
              </button>
              <button
                onClick={handleLeave}
                className="flex items-center gap-1.5 rounded-md border border-red-200 bg-background px-3 py-2 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50 focus-ring min-h-[44px]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Leave
              </button>
            </div>
          </div>
        )}
      </div>

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
