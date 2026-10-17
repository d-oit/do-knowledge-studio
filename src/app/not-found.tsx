import Link from 'next/link'
import { Compass } from 'lucide-react'
import { translate } from '@/lib/i18n/messages/framework-errors'

/**
 * Unmatched-route page (Next.js `not-found.tsx` convention, ADR 035).
 *
 * Renders inside the root layout, so design tokens and fonts are available and
 * the page matches the studio. It covers both cases Next routes here: an
 * explicit `notFound()` from a segment, and a URL that matches no route at all
 * — the studio is a single client-rendered shell with hash-addressed views, so
 * every unmatched path lands on this one page (there is no per-view `not-found`
 * to render instead).
 *
 * Unlike `global-error`, an error here is not what brought the user in: the
 * offer is a way back, not a retry.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md text-center">
        <Compass className="mx-auto mb-3 h-10 w-10 text-saffron" aria-hidden="true" />
        <h1 className="mb-2 font-serif text-xl font-semibold text-ink">{translate('notFound.title')}</h1>
        <p className="mb-4 text-body-sm text-ink-mute">{translate('notFound.description')}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-body-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 focus-ring"
        >
          {translate('notFound.home')}
        </Link>
      </div>
    </div>
  )
}
