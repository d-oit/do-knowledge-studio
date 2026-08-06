'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  WifiOff,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Loader2,
  QrCode,
  Camera,
  Radio,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { QRDisplay, QRScanner } from '../qr-pairing'
import type { PeerInfo } from '@/lib/sync/discovery'

type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
type PairingMode = 'none' | 'display' | 'scan'

/** Generates a short random room ID for peer-to-peer sync pairing. */
export const generateRoomId = (): string => {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10)
}

const StatusBadge = ({ status }: { status: SyncStatus }) => {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Connected
      </span>
    )
  }
  if (status === 'connecting') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-saffron">
        <Loader2 className="h-3 w-3 animate-spin" />
        Connecting
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-red-500">
        <WifiOff className="h-3 w-3" />
        Error
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-faint">
      <WifiOff className="h-3 w-3" />
      Disconnected
    </span>
  )
}

const PairingButtons = ({
  pairingMode,
  onPairingModeChange,
}: {
  pairingMode: PairingMode
  onPairingModeChange: (mode: PairingMode) => void
}) => {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => { onPairingModeChange(pairingMode === 'display' ? 'none' : 'display') }}
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
        onClick={() => { onPairingModeChange(pairingMode === 'scan' ? 'none' : 'scan') }}
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
  )
}

const QrPanel = ({
  mode,
  roomId,
  onQrScan,
  reducedMotion,
}: {
  mode: PairingMode
  roomId: string
  onQrScan: (roomId: string) => void
  reducedMotion: boolean
}) => {
  if (mode === 'none') return null
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="overflow-hidden"
    >
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        {mode === 'display' ? <QRDisplay roomId={roomId || generateRoomId()} /> : <QRScanner onScan={onQrScan} />}
      </div>
    </motion.div>
  )
}

const SyncStatsGrid = ({
  peerCount,
  syncedEntities,
  syncedClaims,
}: {
  peerCount: number
  syncedEntities: number
  syncedClaims: number
}) => {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
        <div className="text-[12px] text-ink-faint">Peers</div>
        <div className="font-mono text-[15px] font-semibold text-ink">{peerCount}</div>
      </div>
      <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
        <div className="text-[12px] text-ink-faint">Entities</div>
        <div data-testid="synced-entities" className="font-mono text-[15px] font-semibold text-ink">{syncedEntities}</div>
      </div>
      <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
        <div className="text-[12px] text-ink-faint">Claims</div>
        <div data-testid="synced-claims" className="font-mono text-[15px] font-semibold text-ink">{syncedClaims}</div>
      </div>
    </div>
  )
}

const PeerList = ({ peers }: { peers: PeerInfo[] }) => {
  if (peers.length === 0) return null
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink">
        <Radio className="h-3 w-3 text-emerald-500" />
        Local Network Peers
      </div>
      <div className="space-y-1">
        {peers.map((peer) => (
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
  )
}

const ConnectedControls = ({
  roomId,
  pairingMode,
  onPairingModeChange,
  onCopyRoomId,
  copied,
  onResync,
  onLeave,
}: {
  roomId: string
  pairingMode: PairingMode
  onPairingModeChange: (mode: PairingMode) => void
  onCopyRoomId: () => void
  copied: boolean
  onResync: () => void
  onLeave: () => void
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
        <div>
          <div className="text-[12px] font-medium text-ink">Room</div>
          <div className="font-mono text-[13px] text-ink-soft">{roomId}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { onPairingModeChange(pairingMode === 'display' ? 'none' : 'display') }}
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
            onClick={onCopyRoomId}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-border hover:text-ink focus-ring"
            aria-label="Copy room ID"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onResync}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring min-h-[44px]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-sync
        </button>
        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 rounded-md border border-red-200 bg-background px-3 py-2 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50 focus-ring min-h-[44px]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Leave
        </button>
      </div>
    </div>
  )
}

const DisconnectedPanel = ({
  inputRoomId,
  onInputChange,
  onJoin,
  pairingMode,
  onPairingModeChange,
  onQrScan,
  reducedMotion,
}: {
  inputRoomId: string
  onInputChange: (value: string) => void
  onJoin: () => void
  pairingMode: PairingMode
  onPairingModeChange: (mode: PairingMode) => void
  onQrScan: (roomId: string) => void
  reducedMotion: boolean
}) => {
  return (
    <div className="space-y-4">
      <PairingButtons pairingMode={pairingMode} onPairingModeChange={onPairingModeChange} />
      <QrPanel mode={pairingMode} roomId="" onQrScan={onQrScan} reducedMotion={reducedMotion} />
      <div>
        <label htmlFor="sync-room-id" className="mb-1.5 text-label font-semibold uppercase tracking-wide text-ink-faint">
          Room ID
        </label>
        <div className="flex gap-2">
          <input
            id="sync-room-id"
            type="text"
            value={inputRoomId}
            onChange={(e) => { onInputChange(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') onJoin() }}
            placeholder="Enter room ID or leave empty to create"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
          />
          <button
            onClick={onJoin}
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
  )
}

/** Connection status card with room management, QR pairing, and peer list. */
export const SyncStatusCard = ({
  status,
  roomId,
  inputRoomId,
  onInputChange,
  onJoin,
  peerCount,
  syncedEntities,
  syncedClaims,
  pairingMode,
  onPairingModeChange,
  discoveredPeers,
  onResync,
  onLeave,
  onQrScan,
}: {
  status: SyncStatus
  roomId: string
  inputRoomId: string
  onInputChange: (value: string) => void
  onJoin: () => void
  peerCount: number
  syncedEntities: number
  syncedClaims: number
  pairingMode: PairingMode
  onPairingModeChange: (mode: PairingMode) => void
  discoveredPeers: PeerInfo[]
  onResync: () => void
  onLeave: () => void
  onQrScan: (roomId: string) => void
}) => {
  const [copied, setCopied] = useState(false)
  const reducedMotion = useReducedMotion()

  const handleCopyRoomId = useCallback(() => {
    if (!roomId) return
    navigator.clipboard.writeText(roomId).then(() => undefined, () => undefined)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2000)
  }, [roomId])

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-[15px] font-semibold text-ink">Connection</h2>
        <div className="flex items-center gap-2" aria-live="polite">
          <StatusBadge status={status} />
        </div>
      </div>

      {status === 'disconnected' ? (
        <DisconnectedPanel
          inputRoomId={inputRoomId}
          onInputChange={onInputChange}
          onJoin={onJoin}
          pairingMode={pairingMode}
          onPairingModeChange={onPairingModeChange}
          onQrScan={onQrScan}
          reducedMotion={reducedMotion}
        />
      ) : (
        <div className="space-y-3">
          <ConnectedControls
            roomId={roomId}
            pairingMode={pairingMode}
            onPairingModeChange={onPairingModeChange}
            onCopyRoomId={handleCopyRoomId}
            copied={copied}
            onResync={onResync}
            onLeave={onLeave}
          />
          <QrPanel mode={pairingMode === 'display' ? 'display' : 'none'} roomId={roomId} onQrScan={onQrScan} reducedMotion={reducedMotion} />
          <SyncStatsGrid peerCount={peerCount} syncedEntities={syncedEntities} syncedClaims={syncedClaims} />
          <PeerList peers={discoveredPeers} />
        </div>
      )}
    </div>
  )
}
