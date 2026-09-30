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

/** Renders the preserved state, the only one a normal quarantine produces. */
const renderPreserved = () =>
  render(
    <Announcer>
      <QuarantineBanner kind="preserved" record={record()} />
    </Announcer>,
  )

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
    renderPreserved()

    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    // The count comes from the preserved payload, not a generic string.
    expect(alert.textContent).toContain('1 entities')
    expect(alert.textContent).toContain('no safe migration from version 99')
  })

  it('does not promise the raw copy can be re-imported', () => {
    renderPreserved()

    // The download is the persistence envelope, not the flat export schema,
    // so Import would reject it. Promising otherwise sends users into a
    // guaranteed failure.
    const body = screen.getByRole('alert').textContent ?? ''
    expect(body).not.toMatch(/re-import it here/i)
    expect(body).toMatch(/not an importable library/i)
  })

  it('is reachable by keyboard at the 44px target floor', () => {
    renderPreserved()

    const download = screen.getByRole('button', { name: /download copy/i })
    const dismiss = screen.getByRole('button', { name: /hide .*this page session/i })
    expect(download.className).toContain('min-h-[44px]')
    expect(dismiss.className).toContain('min-h-[44px]')
    expect(dismiss.className).toContain('min-w-[44px]')
  })

  it('downloads the preserved bytes on request', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderPreserved()

    fireEvent.click(screen.getByRole('button', { name: /download copy/i }))

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
  })

  it('hides the banner for the session without deleting the preserved copy', () => {
    quarantinePayload('no safe migration from version 99', PRESERVED)
    expect(readQuarantine()?.raw).toBe(PRESERVED)

    renderPreserved()
    fireEvent.click(screen.getByRole('button', { name: /hide .*this page session/i }))

    expect(screen.queryByTestId('quarantine-banner')).toBeNull()
    // The bytes MUST survive: this used to call clearQuarantine(), so a single
    // click destroyed the only copy of a user's library.
    expect(readQuarantine()?.raw).toBe(PRESERVED)
    expect(localStorage.getItem(QUARANTINE_KEY)).not.toBeNull()
  })

  it('warns that edits are not saved when no copy was preserved', () => {
    render(
      <Announcer>
        <QuarantineBanner kind="unpreserved" reason="storage quota exceeded" raw={PRESERVED} />
      </Announcer>,
    )

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch(/nothing you change now will be saved/i)
    // The refused bytes are still downloadable even without a quarantine copy.
    expect(screen.getByRole('button', { name: /download copy/i })).toBeDefined()
  })

  it('offers no hide control and no download when the bytes are unreadable', () => {
    render(
      <Announcer>
        <QuarantineBanner kind="unpreserved" reason="storage unreadable" raw={null} />
      </Announcer>,
    )

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch(/cannot read the original bytes/i)
    // Hiding "your work is not being saved" would hide the only warning.
    expect(screen.queryByRole('button', { name: /hide/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /download copy/i })).toBeNull()
  })
})
