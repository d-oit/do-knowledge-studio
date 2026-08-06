'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes'

/** App-level theme provider wrapping next-themes with persisted light/dark toggle. */
export function StudioThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="do-knowledge-studio-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
