'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { logger } from '@/lib/logging/logger'
import { translate } from '@/lib/i18n/messages/framework-errors'

/**
 * Route-segment error boundary (Next.js `error.tsx` convention, ADR 035).
 *
 * This is the safety net *above* the per-view boundaries: it catches what
 * `ViewErrorBoundary` and the view router cannot, i.e. a failure in the shell
 * itself. The props are the Next 16.3 contract — `error` plus the stable
 * `retry()`, which re-fetches and re-renders the failed segment (`reset()`
 * remains for clearing error state without re-fetching, which is not what a
 * user asking to try again expects).
 *
 * Bound to the `app` area so a boundary catch can be correlated with the
 * warnings that preceded it in the same stream.
 */

const log = logger.child({ area: 'app' })

/** Props Next injects into a route-segment error boundary. */
interface RouteErrorProps {
  /** The thrown error; `digest` is set when a server error was forwarded. */
  error: Error & { digest?: string }
  /** Re-fetches and re-renders the failed segment. */
  retry: () => void
}

export default function RouteError({ error, retry }: RouteErrorProps) {
  // Reported from an effect, never during render: rendering runs on every
  // render pass (including the ones React discards), which would multiply
  // entries for one failure, and a sink that threw would re-enter the boundary.
  useEffect(() => {
    log.error('Route segment failed to render', {
      name: error.name,
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-clay" aria-hidden="true" />
        <h1 className="mb-2 font-serif text-xl font-semibold text-ink">
          {translate('frameworkError.title')}
        </h1>
        <p className="mb-4 text-body-sm text-ink-mute">{translate('frameworkError.description')}</p>
        {/* A production server error reaches the client with its message
            replaced by an opaque digest; the digest is what matches the
            server-side log, so it is the one thing worth showing. */}
        {error.digest === undefined ? null : (
          <p className="mb-4 font-mono text-label text-ink-faint">
            {translate('frameworkError.digest', error.digest)}
          </p>
        )}
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-body-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {translate('frameworkError.retry')}
        </button>
      </div>
    </div>
  )
}
