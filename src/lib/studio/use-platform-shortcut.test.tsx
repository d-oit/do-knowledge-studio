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
    // Pins the server-snapshot contract: the SSR HTML derives from the
    // constant non-mac getServerSnapshot regardless of the runtime platform,
    // so SSR HTML and the hydration pass agree. This fails for render-time
    // direct reads — the module-scope `navigator.platform` read from #891, and
    // the subtler `useState(() => read navigator)` — and passes only when the
    // server snapshot is that constant. The next test pins the import-time
    // evaluation order separately; a client-only renderHook case cannot
    // distinguish any of these implementations.
    vi.stubGlobal('navigator', { ...globalThis.navigator, platform: 'MacIntel' })
    const Probe = () => {
      const isMac = useIsMacPlatform()
      return <kbd>{formatShortcut('⌘K', isMac)}</kbd>
    }
    const html = renderToString(<Probe />)
    expect(html).toContain('Ctrl+K')
    expect(html).not.toContain('⌘')
  })

  it('yields the non-mac label when the module evaluates with a mac navigator before stubbing', async () => {
    // Pins the import-time shape (#891's original regression): a
    // module-scope `navigator.platform` read evaluates at import, before any
    // `vi.stubGlobal` in this file can apply. Static import cannot test that
    // boundary — the hoisted import already captured the value — so this test
    // re-imports the module AFTER stubbing the global, simulating the browser
    // evaluation order that produced the #891 mismatch (exempted dynamic
    // import: module-loading-boundary test).
    vi.stubGlobal('navigator', { ...globalThis.navigator, platform: 'MacIntel' })
    vi.resetModules()
    const { useIsMacPlatform: useIsMacFresh } = await import('./use-platform-shortcut')
    const Probe = () => {
      const isMac = useIsMacFresh()
      return <kbd>{formatShortcut('⌘K', isMac)}</kbd>
    }
    const html = renderToString(<Probe />)
    expect(html).toContain('Ctrl+K')
    expect(html).not.toContain('⌘')
    // The hook module was re-imported with a stubbed global; drop it so later
    // suites in this file import the pristine module with the real registry.
    vi.resetModules()
  })
})
