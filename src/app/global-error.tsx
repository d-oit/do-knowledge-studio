'use client'

import { useEffect, useState } from 'react'
import './globals.css'
import { logger } from '@/lib/logging/logger'
import { translate } from '@/lib/i18n/messages/framework-errors'
import { THEME_STORAGE_KEY } from '@/lib/studio/theme-colors'

/**
 * Whole-document fallback (Next.js `global-error.tsx` convention, ADR 035).
 *
 * This file replaces the root layout when the layout itself throws, so it owns
 * the entire document: its own `<html>`/`<body>`, its own stylesheet import,
 * and no providers, fonts or shell from `layout.tsx`. That is also why it is
 * deliberately plain — when the app shell is the thing that failed, the crash
 * page must not depend on anything the shell would have supplied.
 *
 * Next activates it in production only; development keeps the framework error
 * overlay, which is what a developer wants there.
 */

const log = logger.child({ area: 'app' })

/** Theme value `next-themes` stores for a forced dark choice. */
const DARK_THEME = 'dark'

/** Theme value `next-themes` stores for a forced light choice. */
const LIGHT_THEME = 'light'

/** Class the `.dark` token block keys off (`globals.css`). */
const DARK_CLASS = 'dark'

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

/**
 * Resolves the theme class for the replacement document.
 *
 * With no provider mounted, the stored preference is the only signal that a
 * user overrode their operating system; `system` (or a missing value) falls
 * back to the OS preference, which is what the unstyled default would do.
 * @returns `'dark'` or `''`, ready for the document element's `className`.
 */
const resolveThemeClass = (): string => {
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  } catch (error) {
    // Blocked storage (private mode, disabled site data) is not fatal: the OS
    // preference below still renders a usable page. The failure is reported
    // rather than swallowed, so it shows up in the same stream as the crash.
    log.warn('Could not read the stored theme', { error })
  }
  if (stored === LIGHT_THEME) return ''
  if (stored === DARK_THEME) return DARK_CLASS
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? DARK_CLASS : ''
}

/** Props Next injects into the whole-document error boundary. */
interface GlobalErrorProps {
  /** The thrown error; `digest` is set when a server error was forwarded. */
  error: Error & { digest?: string }
  /** Re-fetches and re-renders the root layout. */
  retry: () => void
}

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  const [themeClass, setThemeClass] = useState('')

  // In an effect, never during render: the stored choice lives in the browser,
  // so reading it while rendering would make the served document and the first
  // client pass disagree.
  useEffect(() => {
    setThemeClass(resolveThemeClass())
  }, [])

  useEffect(() => {
    log.error('Root layout failed to render', {
      name: error.name,
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <html lang="en" className={themeClass} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        {/* `metadata` exports are unsupported in this file (it is a client
            component); React's <title> is the documented alternative. */}
        <title>{translate('globalError.title')}</title>
        <div className="flex min-h-dvh items-center justify-center px-6 py-16">
          <div className="w-full max-w-md text-center">
            <h1 className="mb-2 text-xl font-semibold text-ink">{translate('globalError.title')}</h1>
            <p className="mb-4 text-body-sm text-ink-mute">{translate('globalError.description')}</p>
            {error.digest === undefined ? null : (
              <p className="mb-4 font-mono text-label text-ink-faint">
                {translate('globalError.digest', error.digest)}
              </p>
            )}
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-body-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 focus-ring"
            >
              {translate('globalError.retry')}
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
