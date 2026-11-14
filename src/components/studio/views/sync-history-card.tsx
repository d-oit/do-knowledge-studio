'use client'

import { History, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate as t } from '@/lib/i18n/messages/sync'
import { PresenceList } from '../presence-indicator'

/** One entry in the sync event log. */
export interface SyncEvent {
  id: string
  type: 'join' | 'leave' | 'sync' | 'error'
  message: string
  timestamp: number
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

/** Chronological list of sync events. */
export const SyncHistoryCard = ({ events }: { events: SyncEvent[] }) => (
  <div className="rounded-lg border border-border bg-card p-5">
    <h2 className="mb-3 font-serif text-body-lg font-semibold text-ink">
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
export const OnlineUsersCard = ({ visible }: { visible: boolean }) => {
  if (!visible) return null
  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 font-serif text-body-lg font-semibold text-ink">
        <Users className="mr-1.5 inline h-4 w-4" />
        {t('sync.onlineUsers')}
      </h2>
      <PresenceList />
    </div>
  )
}
