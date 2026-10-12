import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockRestoreFromRecovery } = vi.hoisted(() => ({
  mockRestoreFromRecovery: vi.fn(),
}))

vi.mock('@/lib/studio/recovery-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/studio/recovery-helpers')>()),
  restoreFromRecovery: mockRestoreFromRecovery,
}))

const { mockToast, mockAnnounce } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  mockAnnounce: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: mockToast }))
vi.mock('@/lib/a11y/announcer', () => ({ useAnnouncer: () => mockAnnounce }))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

import { RecoveryBanner } from './recovery-banner'

/** The summary the app-shell passes once a restorable snapshot exists. */
const SUMMARY = { entityCount: 2, claimCount: 1 }

const renderBanner = () =>
  render(<RecoveryBanner summary={SUMMARY} />)

const clickRestore = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Restore it' }))
  })
}

describe('RecoveryBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('describes what the snapshot holds', () => {
    renderBanner()

    expect(screen.getByTestId('recovery-banner')).toBeDefined()
    // The counts are interpolated into the banner's body copy.
    expect(screen.getByText(/2 entities and 1 claim/)).toBeDefined()
  })

  it('reports a clean restore and takes the offer away', async () => {
    mockRestoreFromRecovery.mockReturnValue({ success: true, snapshotCleared: true })
    renderBanner()

    await clickRestore()

    expect(mockRestoreFromRecovery).toHaveBeenCalledTimes(1)
    expect(mockToast.success).toHaveBeenCalledWith('Previous library restored')
    expect(mockToast.warning).not.toHaveBeenCalled()
    expect(mockAnnounce).toHaveBeenCalledWith('Previous library restored')
    expect(screen.queryByTestId('recovery-banner')).toBeNull()
  })

  it('tells the user when the restore landed but the snapshot survived', async () => {
    // The typed outcome exists for this case: storage refused to drop the
    // snapshot, so the offer comes back after a reload and a second restore
    // would replace the library with that older copy. A plain success toast
    // would be a false claim about what is still on disk (GitNexus on #925).
    mockRestoreFromRecovery.mockReturnValue({ success: true, snapshotCleared: false })
    renderBanner()

    await clickRestore()

    expect(mockToast.success).not.toHaveBeenCalled()
    expect(mockToast.warning).toHaveBeenCalledWith(
      'Previous library restored. The backup could not be removed, so the restore offer will return after a reload.',
      { description: expect.stringContaining('would not delete the recovery copy') },
    )
    expect(mockAnnounce).toHaveBeenCalledWith(
      'Previous library restored. The backup could not be removed, so the restore offer will return after a reload.',
    )
    // The restored library is on screen; only the offer goes away.
    expect(screen.queryByTestId('recovery-banner')).toBeNull()
  })

  it('keeps the offer up when the restore fails', async () => {
    mockRestoreFromRecovery.mockReturnValue({ success: false, error: 'storage is blocked' })
    renderBanner()

    await clickRestore()

    expect(mockToast.error).toHaveBeenCalledWith('Could not restore the previous library', {
      description: 'storage is blocked',
    })
    expect(screen.getByTestId('recovery-banner')).toBeDefined()
  })

  it('hides the offer for the session without touching the snapshot', async () => {
    renderBanner()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Hide for this page session' }))
    })

    // Dismissal is local state only: restoring is the caller's job, and the
    // bytes stay in storage (a reload brings the offer back).
    expect(mockRestoreFromRecovery).not.toHaveBeenCalled()
    expect(screen.queryByTestId('recovery-banner')).toBeNull()
  })
})
