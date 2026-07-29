import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Toaster } from '../sonner'

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
    setTheme: vi.fn(),
    themes: ['light', 'dark', 'system'],
  })),
}))

describe('Toaster (sonner)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without throwing', () => {
    const { container } = render(<Toaster />)
    expect(container.firstChild).toBeDefined()
  })

  it('renders with aria-live region for screen reader announcements', () => {
    render(<Toaster />)
    const liveRegion = document.querySelector('[aria-live]')
    expect(liveRegion).toBeDefined()
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite')
  })

  it('renders with aria-atomic and aria-relevant for accessibility', () => {
    render(<Toaster />)
    const section = document.querySelector('section[aria-live]')
    expect(section).toBeDefined()
    expect(section?.getAttribute('aria-atomic')).toBe('false')
    expect(section?.getAttribute('aria-relevant')).toContain('additions')
  })

  it('accepts position prop', () => {
    render(<Toaster position="top-center" />)
    const section = document.querySelector('section')
    expect(section).toBeDefined()
  })

  it('accepts richColors prop without throwing', () => {
    render(<Toaster richColors />)
    const section = document.querySelector('section')
    expect(section).toBeDefined()
  })

  it('renders a single toaster section', () => {
    const { container } = render(<Toaster />)
    const sections = container.querySelectorAll('section')
    expect(sections.length).toBe(1)
  })
})
