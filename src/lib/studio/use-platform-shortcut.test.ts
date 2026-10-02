import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatShortcut, useIsMacPlatform } from './use-platform-shortcut'

describe('formatShortcut', () => {
  it('keeps glyphs when the platform is macOS', () => {
    expect(formatShortcut('⌘K', true)).toBe('⌘K')
    expect(formatShortcut('⌘⇧X', true)).toBe('⌘⇧X')
  })

  it('swaps ⌘ and ⇧ for Ctrl+/Shift+ off macOS', () => {
    expect(formatShortcut('⌘K', false)).toBe('Ctrl+K')
    expect(formatShortcut('⌘⇧X', false)).toBe('Ctrl+Shift+X')
    expect(formatShortcut('⌘B', false)).toBe('Ctrl+B')
  })

  it('leaves non-modifier shortcuts untouched', () => {
    expect(formatShortcut('G  H', false)).toBe('G  H')
    expect(formatShortcut('?', false)).toBe('?')
    expect(formatShortcut('Esc', true)).toBe('Esc')
  })
})

describe('useIsMacPlatform', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('reads the real platform on the client', () => {
    vi.stubGlobal('navigator', { ...globalThis.navigator, platform: 'MacIntel' })
    expect(renderHook(() => useIsMacPlatform()).result.current).toBe(true)
    vi.stubGlobal('navigator', { ...globalThis.navigator, platform: 'Win32' })
    expect(renderHook(() => useIsMacPlatform()).result.current).toBe(false)
  })

  it('matches the client snapshot instead of trusting navigator.platform', () => {
    // jsdom's navigator.platform is 'Win32'-ish on CI (never Mac).
    const { result } = renderHook(() => useIsMacPlatform())
    expect(result.current).toBe(false)
  })
})
