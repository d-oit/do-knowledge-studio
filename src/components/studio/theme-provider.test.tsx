import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children, attribute, defaultTheme, storageKey }: {
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
      data-storage-key={storageKey}
    >
      {children}
    </div>
  ),
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

  it('sets default theme to light', () => {
    render(
      <StudioThemeProvider>
        <span>Test</span>
      </StudioThemeProvider>,
    )
    const provider = screen.getByTestId('theme-provider')
    expect(provider).toHaveAttribute('data-default-theme', 'light')
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
