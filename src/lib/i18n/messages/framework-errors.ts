/**
 * Framework-level error surface copy (ADR 035, Plan 130 G1).
 *
 * `src/app/error.tsx`, `global-error.tsx` and `not-found.tsx` are the pages that
 * render when a view module never gets to load, so their strings cannot live
 * beside a view's messages. They live here instead, still going through
 * `makeT` so a future locale layer picks them up like every other message map
 * (AGENTS.md: no hardcoded user-facing strings).
 *
 * Wording rules: state what happened and what the reader can do, and never
 * mention internal machinery. `global-error` runs without the app shell, so its
 * copy must stand alone.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Heading of the route-segment boundary (`src/app/error.tsx`). */
  'frameworkError.title': 'Something went wrong',
  /** Body copy of the route-segment boundary: the promise that data is safe. */
  'frameworkError.description':
    'This page could not be rendered. Your library is stored on this device and has not been changed.',
  /** Re-fetches and re-renders the failed segment. */
  'frameworkError.retry': 'Try again',
  /** Server failures arrive as an opaque digest; surfaced as a support reference. */
  'frameworkError.digest': (digest: string) => `Reference code: ${digest}`,

  /** Heading of the whole-document fallback (`src/app/global-error.tsx`). */
  'globalError.title': 'The studio could not start',
  /** Body copy of the whole-document fallback. */
  'globalError.description': 'A problem in the application shell stopped the studio from loading.',
  /** Reload action of the whole-document fallback. */
  'globalError.retry': 'Reload the studio',
  /** Server failures arrive as an opaque digest; surfaced as a support reference. */
  'globalError.digest': (digest: string) => `Reference code: ${digest}`,

  /** Heading of the unmatched-route page (`src/app/not-found.tsx`). */
  'notFound.title': 'Page not found',
  /** Body copy of the unmatched-route page. */
  'notFound.description': 'That address does not match any page in the studio.',
  /** Link back to the studio home. */
  'notFound.home': 'Back to the studio',
}

/** Typed `translate` helper bound to the framework error message scope. */
export const translate = makeT(messages)
