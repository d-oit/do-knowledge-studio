import { describe, it, expect, vi, afterEach } from 'vitest'
import { readBreakpointPx } from './breakpoints'

describe('readBreakpointPx', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('resolves CSS rem breakpoint tokens against the root font size', () => {
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(((element: Element) => {
      if (element === document.documentElement) {
        return {
          fontSize: '16px',
          getPropertyValue: (name: string) => (name === '--breakpoint-md' ? '48rem' : ''),
        } as unknown as CSSStyleDeclaration
      }
      return { fontSize: '16px', getPropertyValue: () => '' } as unknown as CSSStyleDeclaration
    }) as typeof getComputedStyle)

    expect(readBreakpointPx('--breakpoint-md')).toBe(768)
  })

  it('reads pixel tokens and returns null for missing tokens', () => {
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((() => ({
      fontSize: '16px',
      getPropertyValue: (name: string) => (name === '--breakpoint-lg' ? '1024px' : ''),
    }) as unknown as CSSStyleDeclaration) as typeof getComputedStyle)

    expect(readBreakpointPx('--breakpoint-lg')).toBe(1024)
    expect(readBreakpointPx('--breakpoint-missing')).toBeNull()
  })
})
