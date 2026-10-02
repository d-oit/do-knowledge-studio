import { renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
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

  it('renders the non-mac server snapshot in SSR HTML even with a mac navigator', () => {
    // The hydration invariant: the server snapshot is false regardless of the
    // runtime platform, so SSR HTML and the hydration pass agree and the real
    // platform is corrected right after hydration. This test fails for the
    // pre-fix shapes — a module-scope `navigator.platform` read, and the
    // subtler `useState(() => read navigator)` — and passes only when the
    // server snapshot is the constant non-mac value; a client-only renderHook
    // case cannot distinguish those implementations.
    vi.stubGlobal('navigator', { ...globalThis.navigator, platform: 'MacIntel' })
    const Probe = () => {
      const isMac = useIsMacPlatform()
      return <kbd>{formatShortcut('⌘K', isMac)}</kbd>
    }
    const html = renderToString(<Probe />)
    expect(html).toContain('Ctrl+K')
    expect(html).not.toContain('⌘')
  })
})
