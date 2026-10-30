import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { joinRoom } from '@/lib/sync'
import { mergeIntoYjs } from '@/lib/sync/bridge'

type ProviderEventListener = (payload: unknown) => void
const mockSyncListeners = new Map<string, ProviderEventListener>()
const mockProvider = {
  on: vi.fn((event: string, listener: ProviderEventListener) => {
    mockSyncListeners.set(event, listener)
  }),
  off: vi.fn((event: string) => {
    mockSyncListeners.delete(event)
  }),
  emit: (event: string, payload: unknown) => mockSyncListeners.get(event)?.(payload),
}

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, exit: _e, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    Wifi: Icon,
    WifiOff: Icon,
    Copy: Icon,
    Check: Icon,
    RefreshCw: Icon,
    Trash2: Icon,
    History: Icon,
    Loader2: Icon,
    QrCode: Icon,
    Camera: Icon,
    Radio: Icon,
    Users: Icon,
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('@/lib/sync', () => ({
  initSync: vi.fn(() => Promise.resolve()),
  ensurePersistenceReady: vi.fn(() => Promise.resolve()),
  isPersistenceSynced: vi.fn(() => true),
  joinRoom: vi.fn(() => mockProvider),
  getProvider: vi.fn(() => null),
  getYjsEntities: vi.fn(() => []),
  getYjsClaims: vi.fn(() => []),
  leaveRoom: vi.fn(),
}))

vi.mock('@/lib/sync/bridge', () => ({
  mergeIntoYjs: vi.fn(() => ({ merged: { entities: [], claims: [] }, conflicts: [] })),
  applyConflictResolution: vi.fn(() => true),
  commitMergedState: vi.fn(() => true),
  subscribeSyncConflicts: vi.fn(() => vi.fn()),
}))

vi.mock('@/lib/sync/discovery', () => ({
  startDiscovery: vi.fn(),
  stopDiscovery: vi.fn(),
}))

vi.mock('@/lib/sync/use-presence', () => ({
  usePresence: () => ({ peers: [] }),
}))

vi.mock('../qr-pairing', () => ({
  QRDisplay: ({ roomId }: { roomId: string }) => (
    <div data-testid="qr-display">{roomId}</div>
  ),
  QRScanner: ({ onScan }: { onScan: (roomId: string) => void }) => (
    <div data-testid="qr-scanner">
      <button onClick={() => onScan('scanned-room')}>Simulate scan</button>
    </div>
  ),
}))

vi.mock('../conflict-ui', () => ({
  ConflictUI: ({ conflicts }: { conflicts: unknown[] }) =>
    conflicts.length > 0 ? (
      <div data-testid="conflict-ui">
        <span data-testid="conflict-count">{conflicts.length}</span>
      </div>
    ) : null,

}))
vi.mock('../presence-indicator', () => ({
  PresenceList: () => <div data-testid="presence-list" />,
}))

const mockEntities = [
  {
    id: 'ent-1',
    name: 'Test',
    type: 'note' as const,
    description: '',
    content: '',
    tags: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    links: [],
  },
]

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: mockEntities,
      claims: [],
    }),
}))

import { SyncView } from './sync-view'

describe('SyncView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mergeIntoYjs).mockReset()
    vi.mocked(mergeIntoYjs).mockReturnValue({ merged: { entities: [], claims: [] }, conflicts: [] })
    mockSyncListeners.clear()
  })

  it('renders sync header with title', () => {
    render(<SyncView />)
    expect(screen.getByText('Sync')).toBeDefined()
    expect(screen.getByText(/Connect devices and sync your knowledge base/)).toBeDefined()
  })

  it('shows disconnected state initially', () => {
    render(<SyncView />)
    expect(screen.getByText('Disconnected')).toBeDefined()
  })

  it('QR pairing buttons exist', () => {
    render(<SyncView />)
    expect(screen.getByText('Show QR Code')).toBeDefined()
    expect(screen.getByText('Scan QR Code')).toBeDefined()
  })

  it('manual room ID input exists', () => {
    render(<SyncView />)
    expect(screen.getByPlaceholderText('Enter room ID or leave empty to create')).toBeDefined()
  })

  it('join button exists', () => {
    render(<SyncView />)
    expect(screen.getByText('Join')).toBeDefined()
  })

  it('connection card heading exists', () => {
    render(<SyncView />)
    expect(screen.getByText('Connection')).toBeDefined()
  })

  it('sync history section exists', () => {
    render(<SyncView />)
    expect(screen.getByText('Sync History')).toBeDefined()
  })

  it('shows no sync events message initially', () => {
    render(<SyncView />)
    expect(screen.getByText('No sync events yet.')).toBeDefined()
  })

  it('room ID input has correct label', () => {
    render(<SyncView />)
    expect(screen.getByLabelText('Room ID')).toBeDefined()
  })

  it('help text about sharing room is present', () => {
    render(<SyncView />)
    expect(screen.getByText(/Share the room ID or QR code with another device/)).toBeDefined()
  })

  it('show QR code button exists', () => {
    render(<SyncView />)
    expect(screen.getByText('Show QR Code')).toBeDefined()
  })

  it('scan QR code button exists', () => {
    render(<SyncView />)
    expect(screen.getByText('Scan QR Code')).toBeDefined()
  })

  it('renders wifi icon in header', () => {
    const { container } = render(<SyncView />)
    expect(container.querySelector('[data-testid="icon"]')).toBeDefined()
  })

  it('renders the room password input masked', () => {
    render(<SyncView />)
    expect(screen.getByLabelText('Room password')).toHaveAttribute('type', 'password')
  })

  it('passes the room password through to joinRoom', () => {
    render(<SyncView />)
    fireEvent.change(screen.getByLabelText('Room ID'), { target: { value: 'room-42' } })
    fireEvent.change(screen.getByLabelText('Room password'), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(joinRoom).toHaveBeenCalledWith('room-42', { password: 'hunter2' })
  })

  it('omits the password option entirely when the field is blank', () => {
    render(<SyncView />)
    fireEvent.change(screen.getByLabelText('Room ID'), { target: { value: 'room-99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(joinRoom).toHaveBeenCalledWith('room-99')
  })

  it('never writes the room password into the sync event history', () => {
    render(<SyncView />)
    fireEvent.change(screen.getByLabelText('Room ID'), { target: { value: 'room-7' } })
    fireEvent.change(screen.getByLabelText('Room password'), { target: { value: 'top-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(screen.queryByText(/top-secret/)).toBeNull()
  })

  it('clears conflicts when leaving and joining a room with no conflicts', () => {
    vi.mocked(mergeIntoYjs)
      .mockReturnValueOnce({
        merged: { entities: [], claims: [] },
        conflicts: [{
          entityId: 'ent-1',
          entityType: 'entity',
          field: 'name',
          localValue: 'Local',
          remoteValue: 'Remote',
          winner: 'local',
          reason: 'local newer',
        }],
      })
      .mockReturnValueOnce({ merged: { entities: [], claims: [] }, conflicts: [] })
    render(<SyncView />)
    fireEvent.change(screen.getByLabelText('Room ID'), { target: { value: 'room-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(screen.getByTestId('conflict-count').textContent).toBe('1')
    act(() => { mockProvider.emit('status', { connected: true }) })
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(screen.queryByTestId('conflict-ui')).toBeNull()

    fireEvent.change(screen.getByLabelText('Room ID'), { target: { value: 'room-456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(joinRoom).toHaveBeenNthCalledWith(2, 'room-456')
    expect(screen.queryByTestId('conflict-ui')).toBeNull()
  })

  it('clears prior conflicts when re-sync finds none', () => {
    vi.mocked(mergeIntoYjs)
      .mockReturnValueOnce({
        merged: { entities: [], claims: [] },
        conflicts: [{
          entityId: 'ent-1',
          entityType: 'entity',
          field: 'name',
          localValue: 'Local',
          remoteValue: 'Remote',
          winner: 'local',
          reason: 'local newer',
        }],
      })
      .mockReturnValueOnce({ merged: { entities: [], claims: [] }, conflicts: [] })
    render(<SyncView />)
    fireEvent.change(screen.getByLabelText('Room ID'), { target: { value: 'room-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(screen.getByTestId('conflict-count').textContent).toBe('1')
    act(() => { mockProvider.emit('status', { connected: true }) })
    fireEvent.click(screen.getByRole('button', { name: 'Re-sync' }))
    expect(screen.queryByTestId('conflict-ui')).toBeNull()
  })

  it('toggles QR display mode on and off', () => {
    render(<SyncView />)
    const showQrButton = screen.getByText('Show QR Code')
    fireEvent.click(showQrButton)
    expect(screen.getByTestId('qr-display')).toBeDefined()
    fireEvent.click(showQrButton)
    expect(screen.queryByTestId('qr-display')).toBeNull()
  })

  it('toggles QR scan mode on and off', () => {
    render(<SyncView />)
    const scanButton = screen.getByText('Scan QR Code')
    fireEvent.click(scanButton)
    expect(screen.getByTestId('qr-scanner')).toBeDefined()
    fireEvent.click(scanButton)
    expect(screen.queryByTestId('qr-scanner')).toBeNull()
  })

  it('handles QR scan by updating input room ID', () => {
    render(<SyncView />)
    fireEvent.click(screen.getByText('Scan QR Code'))
    fireEvent.click(screen.getByText('Simulate scan'))
    expect(screen.getByDisplayValue('scanned-room')).toBeDefined()
  })
})
