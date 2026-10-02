import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatShortcut, IS_MAC_PLATFORM } from './platform'

describe('formatShortcut', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('keeps glyphs on macOS', () => {
    expect(formatShortcut('⌘K')).toBe(IS_MAC_PLATFORM ? '⌘K' : 'Ctrl+K')
    expect(formatShortcut('⌘⇧X')).toBe(IS_MAC_PLATFORM ? '⌘⇧X' : 'Ctrl+Shift+X')
  })

  it('swaps ⌘ and ⇧ for Ctrl+/Shift+ off macOS', () => {
    if (IS_MAC_PLATFORM) return // jsdom default platform is non-Mac in CI
    expect(formatShortcut('⌘K')).toBe('Ctrl+K')
    expect(formatShortcut('⌘⇧X')).toBe('Ctrl+Shift+X')
    expect(formatShortcut('⌘B')).toBe('Ctrl+B')
  })

  it('leaves non-modifier shortcuts untouched', () => {
    expect(formatShortcut('G  H')).toBe('G  H')
    expect(formatShortcut('?')).toBe('?')
    expect(formatShortcut('Esc')).toBe('Esc')
  })
})
