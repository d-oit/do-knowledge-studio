'use client'

import { useEffect, useState } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes'
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT, THEME_STORAGE_KEY } from '@/lib/studio/theme-colors'

/** Theme color helper updating meta theme-color to match resolvedTheme. */
const ThemeColorSync = () => {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const metas = document.querySelectorAll('meta[name="theme-color"]')
    const targetColor = resolvedTheme === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT

    if (metas.length > 0) {
      metas.forEach((meta) => {
        meta.setAttribute('content', targetColor)
      })
    } else {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      meta.setAttribute('content', targetColor)
      document.head.appendChild(meta)
    }
  }, [resolvedTheme])

  return null
}

/**
 * The stored theme choice, held back until after mount.
 *
 * `next-themes` resolves its state from `localStorage` inside the client's
 * *first* render, so a control that renders the stored *choice* produces markup
 * the server could not have sent — the server rendered `defaultTheme` (here
 * `system`). React then reports a hydration mismatch and re-renders the subtree
 * on every load, for every user who has ever picked a theme.
 *
 * Returning `undefined` until the mount effect has run keeps the first client
 * render identical to the server's, and the real choice lands immediately
 * afterwards. It is the same contract as `useReducedMotion`
 * (`src/lib/studio/use-reduced-motion.ts`), and it is pinned in a real browser
 * by `e2e/hydration-mismatch.spec.ts`.
 *
 * Consumers keep their own `theme ?? 'system'` fallback; this hook only decides
 * *when* the client may believe the stored value.
 */
export const useHydrationSafeTheme = (): {
  theme: string | undefined
  setTheme: (theme: string) => void
} => {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return { theme: mounted ? theme : undefined, setTheme }
}

/** App-level theme provider wrapping next-themes with persisted light/dark/system toggle. */
export const StudioThemeProvider = ({ children, ...props }: ThemeProviderProps) => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey={THEME_STORAGE_KEY}
      {...props}
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}
