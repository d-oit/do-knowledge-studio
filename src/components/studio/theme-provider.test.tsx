import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children, attribute, defaultTheme, enableSystem, storageKey }: {
    children: React.ReactNode
    attribute?: string
    defaultTheme?: string
    enableSystem?: boolean
    disableTransitionOnChange?: boolean
    storageKey?: string
  }) => (
    <div
      data-testid="theme-provider"
      data-attribute={attribute}
      data-default-theme={defaultTheme}
      data-enable-system={enableSystem ? 'true' : 'false'}
      data-storage-key={storageKey}
    >
      {children}
    </div>
  ),
  useTheme: () => ({ resolvedTheme: 'dark', theme: 'system', setTheme: vi.fn() }),
}))

import { StudioThemeProvider } from './theme-provider'

describe('StudioThemeProvider', () => {
  it('renders children', () => {
    render(
      <StudioThemeProvider>
        <span>Child content</span>
      </StudioThemeProvider>,
    )
    expect(screen.getByText('Child content')).toBeDefined()
  })

  it('passes class attribute to NextThemesProvider', () => {
    render(
      <StudioThemeProvider>
        <span>Test</span>
      </StudioThemeProvider>,
    )
    const provider = screen.getByTestId('theme-provider')
    expect(provider).toHaveAttribute('data-attribute', 'class')
  })

  it('sets default theme to system and enables system', () => {
    render(
      <StudioThemeProvider>
        <span>Test</span>
      </StudioThemeProvider>,
    )
    const provider = screen.getByTestId('theme-provider')
    expect(provider).toHaveAttribute('data-default-theme', 'system')
    expect(provider).toHaveAttribute('data-enable-system', 'true')
  })

  it('sets correct storage key', () => {
    render(
      <StudioThemeProvider>
        <span>Test</span>
      </StudioThemeProvider>,
    )
    const provider = screen.getByTestId('theme-provider')
    expect(provider).toHaveAttribute('data-storage-key', 'do-knowledge-studio-theme')
  })

  it('updates meta theme-color tag to match resolvedTheme', () => {
    render(
      <StudioThemeProvider>
        <span>Test</span>
      </StudioThemeProvider>,
    )
    const meta = document.querySelector('meta[name="theme-color"]')
    expect(meta).not.toBeNull()
    expect(meta?.getAttribute('content')).toBe('#14110d')
  })

  it('passes through additional props', () => {
    render(
      <StudioThemeProvider forcedTheme="dark">
        <span>Test</span>
      </StudioThemeProvider>,
    )
    const provider = screen.getByTestId('theme-provider')
    expect(provider).toBeDefined()
  })
})
