import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QuarantineBanner } from './quarantine-banner'
import { Announcer } from '@/lib/a11y/announcer'
import { QUARANTINE_KEY, quarantinePayload, readQuarantine, type QuarantineRecord } from '@/lib/studio/hydration-quarantine'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { AlertTriangle: Icon, Download: Icon, X: Icon }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

/** A stored envelope containing one entity, as a real rejection would leave. */
const PRESERVED = JSON.stringify({
  state: {
    entities: [
      {
        id: 'lost-1',
        name: 'Lost Note',
        type: 'note',
        description: '',
        content: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        links: [],
      },
    ],
    claims: [],
  },
  version: 99,
})

const record = (): QuarantineRecord => ({
  rejectedAt: '2026-09-28T00:00:00.000Z',
  reason: 'no safe migration from version 99',
  raw: PRESERVED,
})

describe('QuarantineBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    // jsdom lacks object-URL plumbing used by the download path.
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('announces itself as an alert and names what was preserved', () => {
    render(
      <Announcer>
        <QuarantineBanner record={record()} />
      </Announcer>,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    // The count comes from the preserved payload, not a generic string.
    expect(alert.textContent).toContain('1 entities')
    expect(alert.textContent).toContain('no safe migration from version 99')
  })

  it('is reachable by keyboard at the 44px target floor', () => {
    render(
      <Announcer>
        <QuarantineBanner record={record()} />
      </Announcer>,
    )

    const download = screen.getByRole('button', { name: /download copy/i })
    const dismiss = screen.getByRole('button', { name: /discard/i })
    expect(download.className).toContain('min-h-[44px]')
    expect(dismiss.className).toContain('min-h-[44px]')
    expect(dismiss.className).toContain('min-w-[44px]')
  })

  it('downloads the preserved bytes on request', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(
      <Announcer>
        <QuarantineBanner record={record()} />
      </Announcer>,
    )

    fireEvent.click(screen.getByRole('button', { name: /download copy/i }))

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
  })

  it('discards the preserved copy and stops rendering the banner', () => {
    quarantinePayload('no safe migration from version 99', PRESERVED)
    expect(readQuarantine()?.raw).toBe(PRESERVED)

    render(
      <Announcer>
        <QuarantineBanner record={record()} />
      </Announcer>,
    )
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))

    expect(screen.queryByTestId('quarantine-banner')).toBeNull()
    // The bytes are gone too — a dismissed banner must not leave a payload
    // behind that implies an available recovery that no longer exists.
    expect(readQuarantine()).toBeNull()
    expect(localStorage.getItem(QUARANTINE_KEY)).toBeNull()
  })
})
