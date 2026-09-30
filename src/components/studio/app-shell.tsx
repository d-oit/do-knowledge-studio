'use client'

import { useStudioStore } from '@/lib/studio/store'
import type { ViewId } from '@/lib/studio/types'
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from './command-palette'
import { RightPanel } from './right-panel'
import { MobileDrawer } from './mobile-drawer'
import { ShortcutsDialog } from './shortcuts-dialog'
import { HomeView } from './views/home-view'
import { EditorView } from './views/editor-view'
import { LibraryView } from './views/library-view'
import { TimelineView } from './views/timeline-view'
import { ChatView } from './views/chat-view'
import { ErrorBoundary } from './error-boundary'
import { ViewErrorBoundary } from './view-error-boundary'
import { Skeleton } from './ui/skeleton'
import { startBidirectionalSync } from '@/lib/sync/bridge'
import { translate } from '@/lib/i18n/messages/timeline'
import { readQuarantine, type QuarantineRecord } from '@/lib/studio/hydration-quarantine'
import {
  getHydrationRefusal,
  subscribeToHydrationRefusal,
  type HydrationRefusal,
} from '@/lib/studio/hydration-guard'
import { QuarantineBanner } from './views/quarantine-banner'

const GraphView = lazy(() => import('./views/graph-view').then((m) => ({ default: m.GraphView })))
const MindMapView = lazy(() => import('./views/mindmap-view').then((m) => ({ default: m.MindMapView })))
const AIHarnessView = lazy(() => import('./views/ai-harness-view').then((m) => ({ default: m.AIHarnessView })))
const TrizView = lazy(() => import('./views/triz-view').then((m) => ({ default: m.TrizView })))
const ExportView = lazy(() => import('./views/export-view').then((m) => ({ default: m.ExportView })))
const SyncView = lazy(() => import('./views/sync-view').then((m) => ({ default: m.SyncView })))

/** Loading skeleton placeholder shown while lazy-loaded views are being fetched. */
function ViewLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}

/**
 * View id → display name. Held in a Map so the lookup is a method call rather
 * than dynamic property access on an object (static-analysis object-injection
 * sink), while staying a single table instead of a per-view switch.
 */
const VIEW_NAMES = new Map<ViewId, string>([
  ['home', 'Home'],
  ['editor', 'Editor'],
  ['library', 'Library'],
  ['timeline', translate('timeline.nav.label')],
  ['graph', 'Graph'],
  ['mindmap', 'Mind Map'],
  ['chat', 'Chat'],
  ['ai', 'AI Harness'],
  ['triz', 'TRIZ Matrix'],
  ['export', 'Export'],
  ['sync', 'Sync'],
])

/** Returns a human-readable display name for a given view ID. */
const getViewName = (view: ViewId): string => VIEW_NAMES.get(view) ?? ''

/** Pairs a view id with its element for the router's lookup table. */
const viewEntry = (id: ViewId, element: React.ReactNode): [ViewId, React.ReactNode] => [
  id,
  element,
]

/**
 * Total view → element map. A Map (rather than a Record) keeps the router's
 * lookups off dynamic property access while still collapsing the per-view
 * boolean chain into one branch, so the router's complexity stays at 1.
 * Entries go through {@link viewEntry} so the JSX lives in call arguments
 * rather than as bare array elements (which require React keys).
 */
const VIEW_ELEMENTS = new Map<ViewId, React.ReactNode>([
  viewEntry('home', <HomeView />),
  viewEntry('editor', null), // Needs the editingEntityId key — handled in ViewRouter.
  viewEntry('library', <LibraryView />),
  viewEntry('timeline', <TimelineView />),
  viewEntry('graph', <GraphView />),
  viewEntry('mindmap', <MindMapView />),
  viewEntry('chat', <ChatView />),
  viewEntry('ai', <AIHarnessView />),
  viewEntry('triz', <TrizView />),
  viewEntry('export', <ExportView />),
  viewEntry('sync', <SyncView />),
])

/**
 * Stand-in for the Sync view while hydration was refused.
 *
 * SyncView can join a room, resync, and resolve conflicts, all of which act on
 * the store. After a refusal that store is a seed workspace which never held
 * the user's corpus, so any of those actions would publish or overwrite a real
 * library with demo data. The global recovery alert above stays visible; this
 * only replaces the view body.
 */
const SyncUnavailable = () => (
  <div role="status" data-testid="sync-unavailable" className="mx-auto max-w-5xl px-6 py-6 lg:px-10 lg:py-8">
    <h2 className="font-serif text-lg font-semibold text-ink">Sync is unavailable</h2>
    <p className="mt-2 text-[13px] text-ink-soft">
      Your library could not be loaded, so this session is working on temporary data. Syncing
      would publish that temporary library and overwrite the real one in your other tabs. Sync
      returns by itself once this page loads a library it can read.
    </p>
  </div>
)

/** Renders the active view inside the error/suspense boundaries. */
const ViewRouter = ({
  currentView,
  editingEntityId,
  syncBlocked,
  onError,
}: {
  currentView: ViewId
  editingEntityId: string | null
  syncBlocked: boolean
  onError: (error: Error, errorInfo: React.ErrorInfo) => void
}) => {
  const activeView =
    currentView === 'sync' && syncBlocked ? (
      <SyncUnavailable />
    ) : currentView === 'editor' ? (
      <EditorView key={editingEntityId || 'new'} />
    ) : (
      VIEW_ELEMENTS.get(currentView)
    )
  return (
    <ErrorBoundary key={currentView}>
      <ViewErrorBoundary viewName={getViewName(currentView)} onError={onError}>
        <Suspense fallback={<ViewLoader />}>{activeView}</Suspense>
      </ViewErrorBoundary>
    </ErrorBoundary>
  )
}

/**
 * Subscribes to the hydration refusal status.
 *
 * Initialized to null and filled in an effect, never from `getHydrationRefusal`
 * during render: the refusal status only exists in the browser, so reading it
 * while rendering makes the server output (no alert) differ from the first
 * client pass (alert present). That mismatch forces React to discard the
 * server-rendered tree (plans/149 §4).
 *
 * A refusal can also land after mount (a late or manual `rehydrate()`), which
 * is why this subscribes instead of reading once — both the Yjs gate and the
 * Sync gate must react rather than snapshot the status at first render.
 */
const useHydrationRefusal = (): HydrationRefusal | null => {
  const [refusal, setRefusal] = useState<HydrationRefusal | null>(null)
  useEffect(() => {
    // Re-read on subscribe: the status may have changed between render and
    // the effect running.
    setRefusal(getHydrationRefusal())
    return subscribeToHydrationRefusal(() => {
      setRefusal(getHydrationRefusal())
    })
  }, [])
  return refusal
}

/**
 * Global recovery alerts, mounted above every view.
 *
 * A refused persistence envelope used to be reported only inside the lazy
 * Export view, so a user whose library failed to hydrate landed on Home
 * looking at the demo seed set with no sign their data existed. Both alerts
 * are shown when both apply: the quarantined copy and the currently refused
 * bytes can be different envelopes, and each needs its own way out.
 *
 * State is initialized in an effect rather than during render so SSR and the
 * first client pass produce identical markup, and refreshed on
 * `onFinishHydration` so a late rehydration is picked up too.
 */
const RecoveryAlerts = ({ refusal }: { refusal: HydrationRefusal | null }) => {
  const [record, setRecord] = useState<QuarantineRecord | null>(null)

  const refreshRecord = useCallback(() => {
    setRecord(readQuarantine())
  }, [])

  useEffect(() => {
    refreshRecord()
    // A late or manual rehydrate can refuse after mount, so the quarantine
    // record is re-read on hydration completion rather than captured once.
    return useStudioStore.persist.onFinishHydration(refreshRecord)
  }, [refreshRecord])

  if (record === null && refusal === null) return null

  return (
    <div className="mx-auto max-w-5xl px-6 pt-6 lg:px-10">
      {record && <QuarantineBanner kind="preserved" record={record} />}
      {refusal?.preserved === false && (
        <QuarantineBanner kind="unpreserved" reason={refusal.reason} raw={refusal.raw} />
      )}
    </div>
  )
}

/** Root application shell composing sidebar, topbar, view router, right panel, and overlays. */
export const AppShell = () => {
  const currentView = useStudioStore((s) => s.currentView)
  const editingEntityId = useStudioStore((s) => s.editingEntityId)
  const [appReady, setAppReady] = useState(false)
  const refusal = useHydrationRefusal()

  // The Yjs bridge must not run on a refused hydrate. It would merge inbound
  // peer updates into a seed workspace and publish that seed corpus outward,
  // so the real library gets replaced by demo data in the shared document.
  //
  // The gate reads the LIVE status rather than `refusal` from render state:
  // the hook starts at null (so SSR markup matches) and fills in from an
  // effect, which is too late for this effect on the first pass. The effect
  // still re-runs when the status changes, so a refusal arriving after mount
  // tears the bridge down through its own cleanup.
  useEffect(() => {
    if (getHydrationRefusal() !== null) return
    return startBidirectionalSync()
  }, [refusal])

  // Readiness hook for the E2E `waitForAppReady` helper. React flushes child
  // effects before parent effects, so once this flag is set every descendant
  // listener (the Ctrl+K handler in CommandPalette, Escape handlers, ...) has
  // been bound. It is set from an effect rather than rendered during hydration,
  // so server and client markup still match on the first pass (plans/149 §4).
  useEffect(() => {
    setAppReady(true)
  }, [])

  const handleViewError = React.useCallback(
    (error: Error, _errorInfo: React.ErrorInfo) => {
      console.error(`[ViewError] ${currentView}:`, error)
    },
    [currentView],
  )

  return (
    <div
      className="flex h-dvh w-full overflow-hidden bg-background text-foreground"
      data-app-ready={appReady ? 'true' : undefined}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[1000] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:ring-2 focus:ring-saffron focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main-content" className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            {/* Above the view router and inside the scrollable main column, so
                the alert is on every view and scrolls with the content rather
                than overlaying or trapping the workspace. */}
            <RecoveryAlerts refusal={refusal} />
            <ViewRouter
              currentView={currentView}
              editingEntityId={editingEntityId}
              syncBlocked={refusal !== null}
              onError={handleViewError}
            />
          </div>
          <RightPanel />
        </main>
        <footer role="contentinfo" className="border-t border-border px-5 py-2 text-[11px] text-ink-faint">
          Knowledge Studio — local-first knowledge engine
        </footer>
      </div>
      <CommandPalette
        onEntitySelect={(id) => {
          useStudioStore.getState().startEdit(id)
        }}
      />
      <MobileDrawer />
      <ShortcutsDialog />
    </div>
  )
}