import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockRestoreFromRecovery, mockDescribeRecoverySnapshot } = vi.hoisted(() => ({
  mockRestoreFromRecovery: vi.fn(),
  mockDescribeRecoverySnapshot: vi.fn(),
}))

vi.mock('@/lib/studio/recovery-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/studio/recovery-helpers')>()),
  restoreFromRecovery: mockRestoreFromRecovery,
  describeRecoverySnapshot: mockDescribeRecoverySnapshot,
  subscribeToRecoveryAvailability: () => () => {},
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

import { RecoveryPanel } from './recovery-panel'

describe('RecoveryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when no recovery snapshot exists', () => {
    mockDescribeRecoverySnapshot.mockReturnValue(null)
    render(<RecoveryPanel />)

    expect(screen.queryByTestId('recovery-panel')).toBeNull()
  })

  it('renders snapshot details and executes restore on confirmation', async () => {
    mockDescribeRecoverySnapshot.mockReturnValue({
      entityCount: 4,
      claimCount: 2,
      timestamp: 1760000000000,
      isImmediatePreImport: true,
    })
    mockRestoreFromRecovery.mockReturnValue({ success: true, snapshotCleared: true })

    render(<RecoveryPanel />)

    expect(screen.getByTestId('recovery-panel')).toBeDefined()
    expect(screen.getByText('Pre-import Recovery Snapshot')).toBeDefined()
    expect(screen.getByText('Immediate Pre-Import Backup')).toBeDefined()
    expect(screen.getByText(/4 entities and 2 claims/)).toBeDefined()

    // Open confirm dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restore this snapshot' }))
    })

    expect(screen.getByText('Restore Pre-Import Snapshot?')).toBeDefined()

    // Confirm restore
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restore it' }))
    })

    expect(mockRestoreFromRecovery).toHaveBeenCalledTimes(1)
    expect(mockToast.success).toHaveBeenCalledWith('Previous library restored')
  })
})
