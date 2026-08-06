'use client'

import { cn } from '@/lib/utils'
import { usePresence, type UserPresence } from '@/lib/sync/use-presence'

interface PresenceIndicatorProps {
  className?: string
}

/** Compact avatar stack showing the count of online peers. */
export function PresenceIndicator({ className }: PresenceIndicatorProps) {
  const { peers, peerCount } = usePresence()

  if (peerCount <= 1) return null

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex -space-x-1.5">
        {peers.slice(0, 5).map((peer) => (
          <div
            key={peer.deviceId}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-background text-[8px] font-bold text-white"
            style={{ backgroundColor: peer.color }}
            title={peer.name}
          >
            {peer.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {peers.length > 5 && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted text-[8px] font-bold text-ink-faint">
            +{peers.length - 5}
          </div>
        )}
      </div>
      <span className="text-[11px] text-ink-faint">
        {peerCount} online
      </span>
    </div>
  )
}

/** Full list of connected peers with names, colors, and current view. */
export function PresenceList({ className }: { className?: string }) {
  const { peers, localPresence } = usePresence()

  return (
    <div className={cn('space-y-1', className)}>
      {localPresence && (
        <PresenceRow presence={localPresence} isLocal />
      )}
      {peers.map((peer) => (
        <PresenceRow key={peer.deviceId} presence={peer} />
      ))}
    </div>
  )
}

/** Single row in the presence list showing a peer&apos;s avatar, name, and view. */
function PresenceRow({
  presence,
  isLocal = false,
}: {
  presence: UserPresence
  isLocal?: boolean
}) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px]">
      <div
        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: presence.color }}
      >
        {presence.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="font-medium text-ink">
          {presence.name}
          {isLocal && <span className="ml-1 text-ink-faint">(you)</span>}
        </div>
        <div className="text-[11px] text-ink-faint">
          {presence.currentView}
        </div>
      </div>
    </div>
  )
}
