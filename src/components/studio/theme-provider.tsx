'use client'

import { useEffect } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes'
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '@/lib/studio/theme-colors'

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

/** App-level theme provider wrapping next-themes with persisted light/dark/system toggle. */
export const StudioThemeProvider = ({ children, ...props }: ThemeProviderProps) => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="do-knowledge-studio-theme"
      {...props}
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}
