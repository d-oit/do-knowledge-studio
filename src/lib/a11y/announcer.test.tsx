import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, screen } from '@testing-library/react'
import { Announcer, useAnnouncer } from './announcer'

function TestComponent() {
  const announce = useAnnouncer()
  return (
    <button onClick={() => announce('Test message')}>Announce</button>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Announcer', () => {
  it('renders visually hidden aria-live region', () => {
    render(<Announcer />)
    const liveRegion = screen.getByRole('status')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
  })

  it('announce writes to aria-live region after delay', async () => {
    render(
      <Announcer>
        <TestComponent />
      </Announcer>,
    )
    const button = screen.getByRole('button', { name: /announce/i })
    const liveRegion = screen.getByRole('status')

    act(() => {
      button.click()
    })

    expect(liveRegion.textContent).toBe('')

    act(() => {
      vi.advanceTimersByTime(60)
    })

    expect(liveRegion.textContent).toBe('Test message')
  })

  it('cleans up content on unmount', () => {
    const { unmount } = render(
      <Announcer>
        <TestComponent />
      </Announcer>,
    )
    const button = screen.getByRole('button', { name: /announce/i })

    act(() => {
      button.click()
    })

    unmount()
  })
})

describe('useAnnouncer', () => {
  it('throws when used outside Announcer provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function BadComponent() {
      useAnnouncer()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useAnnouncer must be used within an <Announcer /> provider',
    )

    consoleError.mockRestore()
  })
})
