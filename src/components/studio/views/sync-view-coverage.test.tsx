import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'

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

const createMockProvider = () => {
  const handlers: Record<string, Array<(data: unknown) => void>> = {}
  return {
    on: vi.fn((event: string, callback: (data: unknown) => void) => {
      handlers[event] = handlers[event] ?? []
      handlers[event].push(callback)
    }),
    off: vi.fn((event: string, callback: (data: unknown) => void) => {
      handlers[event] = (handlers[event] ?? []).filter((stored) => stored !== callback)
    }),
    emit: (event: string, data: unknown) => {
      handlers[event]?.forEach((callback) => { callback(data) })
    },
    clear: () => {
      Object.keys(handlers).forEach((event) => { handlers[event] = [] })
    },
  }
}

const mockProvider = createMockProvider()
let mockProviderForJoin = mockProvider
let mockProviderAtMount: typeof mockProvider | null = mockProvider
const mockEmit = (event: string, data: unknown) => { mockProvider.emit(event, data) }

vi.mock('@/lib/sync', () => ({
  initSync: vi.fn(() => Promise.resolve()),
  joinRoom: vi.fn(() => {
    mockProviderAtMount = mockProviderForJoin
    return mockProviderForJoin
  }),
  getProvider: vi.fn(() => mockProviderAtMount),
  getYjsEntities: vi.fn(() => [{ id: 'yjs-ent' }]),
  getYjsClaims: vi.fn(() => [{ id: 'yjs-claim' }]),
  leaveRoom: vi.fn(() => { mockProviderAtMount = null }),
}))

import { mergeIntoYjs, applyConflictResolution } from '@/lib/sync/bridge'
import { joinRoom } from '@/lib/sync'
import type { FieldConflict } from '@/lib/sync/merge'

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
      <button onClick={() => { onScan('scanned-room') }}>Simulate scan</button>
    </div>
  ),
}))

vi.mock('../conflict-ui', () => ({
  ConflictUI: ({ onResolve, onDismiss, conflicts }: { onResolve: (resolutions: Map<string, 'local' | 'remote'>) => void; onDismiss: () => void; conflicts: FieldConflict[] }) => (
    <div data-testid="conflict-ui">
      <span data-testid="conflict-count">{conflicts.length}</span>
      <button onClick={() => { onResolve(new Map([['c1', 'local']])) }}>Resolve</button>
      <button onClick={() => { onDismiss() }}>Dismiss</button>
    </div>
  ),
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
const mockClaims: Array<{ id: string }> = []

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      entities: mockEntities,
      claims: mockClaims,
    }),
}))

import { SyncView } from './sync-view'

describe('SyncView branch coverage', () => {
  let originalClipboard: Clipboard | undefined

  afterEach(() => {
    cleanup()
    if (originalClipboard) {
      vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: originalClipboard })
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider.clear()
    mockProviderForJoin = mockProvider
    mockProviderAtMount = mockProvider
    mockEntities.splice(1)
    mockClaims.length = 0

    vi.mocked(mergeIntoYjs).mockReturnValue({ merged: { entities: [], claims: [] }, conflicts: [] })
    originalClipboard = globalThis.navigator.clipboard
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
  })

  it('shows connecting state after clicking join', async () => {
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => {
      expect(screen.getByText('Connecting')).toBeDefined()
    })
  })

  it('joins room with a specific ID and exposes its active state via provider status', async () => {
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    expect(screen.getByText('Room active')).toBeDefined()
    expect(screen.getByText('Room is active')).toBeDefined()
    expect(screen.getByText('Merged 0 entities, 0 claims')).toBeDefined()
  })

  it('updates sync counts after connected store changes without another synced event', async () => {
    const { rerender } = render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => {
      expect(screen.getByTestId('synced-entities').textContent).toBe('1')
      expect(screen.getByTestId('synced-claims').textContent).toBe('0')
    })

    mockEntities.push({ ...mockEntities[0], id: 'ent-2', name: 'Synced addition' })
    mockClaims.push({ id: 'claim-1' })
    rerender(<SyncView />)
    await waitFor(() => {
      expect(screen.getByTestId('synced-entities').textContent).toBe('2')
      expect(screen.getByTestId('synced-claims').textContent).toBe('1')
    })
  })

  it('generates a room ID when input is empty', async () => {
    const { joinRoom } = await import('@/lib/sync')
    render(<SyncView />)
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalled() })
    const roomId = vi.mocked(joinRoom).mock.calls[0][0]
    expect(typeof roomId).toBe('string')
    expect(roomId.length).toBeGreaterThan(0)
  })

  it('handles join errors and shows error status', async () => {
    const { joinRoom } = await import('@/lib/sync')
    vi.mocked(joinRoom).mockImplementationOnce(() => { throw new Error('network failure') })
    render(<SyncView />)
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(screen.getByText('Error')).toBeDefined() })
  })

  it('updates peer count on provider peers event', async () => {
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    act(() => { mockEmit('peers', { webrtcPeers: ['a', 'b'], bcPeers: ['c'] }) })
    await waitFor(() => { expect(screen.getByText('3')).toBeDefined() })
  })

  it('updates synced entity and claim counts on provider synced event', async () => {
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    act(() => { mockEmit('synced', {}) })
    await waitFor(() => {
      expect(screen.getByTestId('synced-entities').textContent).toBe('1')
    })
  })

  it('leaves room and resets state', async () => {
    const { leaveRoom } = await import('@/lib/sync')
    const { stopDiscovery } = await import('@/lib/sync/discovery')
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    fireEvent.click(screen.getByText('Leave'))
    await waitFor(() => {
      expect(stopDiscovery).toHaveBeenCalled()
      expect(leaveRoom).toHaveBeenCalled()
      expect(screen.getByText('Disconnected')).toBeDefined()
    })
  })

  it('surfaces join conflicts in the conflict UI', async () => {
    vi.mocked(mergeIntoYjs).mockReturnValue({
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
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalledWith('room-123')
      expect(screen.getByTestId('conflict-count').textContent).toBe('1')
    })
  })

  it('binds provider events after join and rebinds after leaving', async () => {
    const secondProvider = createMockProvider()
    mockProviderAtMount = null
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledTimes(1) })
    act(() => { mockProvider.emit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    act(() => { mockProvider.emit('peers', { webrtcPeers: ['first'], bcPeers: [] }) })
    await waitFor(() => { expect(screen.getByText('Peers').parentElement?.textContent).toBe('Peers1') })
    act(() => { mockProvider.emit('synced', {}) })
    await waitFor(() => { expect(screen.getByTestId('synced-entities').textContent).toBe('1') })

    fireEvent.click(screen.getByText('Leave'))
    await waitFor(() => { expect(screen.getByText('Disconnected')).toBeDefined() })
    mockProviderForJoin = secondProvider
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledTimes(2) })
    await waitFor(() => {
      expect(secondProvider.on).toHaveBeenCalledWith('peers', expect.any(Function))
    })
    act(() => { secondProvider.emit('peers', { webrtcPeers: ['second'], bcPeers: [] }) })
    await waitFor(() => { expect(screen.getByText('Peers').parentElement?.textContent).toBe('Peers1') })
  })

  it('copies room ID when connected', async () => {
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    const copyButton = screen.getByLabelText('Copy room ID')
    fireEvent.click(copyButton)
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('room-123')
    })
  })

  it('re-syncs without conflicts and shows success', async () => {
    const { toast } = await import('sonner')
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    fireEvent.click(screen.getByText('Re-sync'))
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Re-synced local data')
    })
  })

  it('re-syncs with conflicts and renders ConflictUI', async () => {
    vi.mocked(mergeIntoYjs).mockReturnValue({
      merged: { entities: [], claims: [] },
      conflicts: [
        {
          entityId: 'ent-1',
          entityType: 'entity',
          field: 'name',
          localValue: 'Local',
          remoteValue: 'Remote',
          winner: 'local',
          reason: 'local newer',
        },
      ],
    })
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    fireEvent.click(screen.getByText('Re-sync'))
    await waitFor(() => { expect(screen.getByTestId('conflict-ui')).toBeDefined() })
  })

  it('resolves conflicts and clears ConflictUI', async () => {
    vi.mocked(mergeIntoYjs).mockReturnValue({
      merged: { entities: [], claims: [] },
      conflicts: [
        {
          entityId: 'ent-1',
          entityType: 'entity',
          field: 'name',
          localValue: 'Local',
          remoteValue: 'Remote',
          winner: 'local',
          reason: 'local newer',
        },
      ],
    })
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    fireEvent.click(screen.getByText('Re-sync'))
    await waitFor(() => { expect(screen.getByTestId('conflict-ui')).toBeDefined() })
    fireEvent.click(screen.getByText('Resolve'))
    await waitFor(() => { expect(screen.queryByTestId('conflict-ui')).toBeNull() })
    expect(applyConflictResolution).toHaveBeenCalled()
  })

  it('dismisses conflicts and clears ConflictUI', async () => {
    vi.mocked(mergeIntoYjs).mockReturnValue({
      merged: { entities: [], claims: [] },
      conflicts: [
        {
          entityId: 'ent-1',
          entityType: 'entity',
          field: 'name',
          localValue: 'Local',
          remoteValue: 'Remote',
          winner: 'local',
          reason: 'local newer',
        },
      ],
    })
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    fireEvent.click(screen.getByText('Re-sync'))
    await waitFor(() => { expect(screen.getByTestId('conflict-ui')).toBeDefined() })
    fireEvent.click(screen.getByText('Dismiss'))
    await waitFor(() => { expect(screen.queryByTestId('conflict-ui')).toBeNull() })
  })


  it('shows error status indicator when provider emits disconnected status', async () => {
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    act(() => { mockEmit('status', { connected: false }) })
    await waitFor(() => { expect(screen.getByText('Disconnected')).toBeDefined() })
  })

  it('shows discovered peers when connected', async () => {
    const { startDiscovery } = await import('@/lib/sync/discovery')
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(joinRoom).toHaveBeenCalledWith('room-123') })
    act(() => { mockEmit('status', { connected: true }) })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Re-sync' })).toBeDefined() })
    await waitFor(() => { expect(startDiscovery).toHaveBeenCalled() })
    act(() => {
      const discoveryCb = vi.mocked(startDiscovery).mock.calls[0][1]
      discoveryCb([
        { deviceId: 'd1', deviceName: 'Phone', roomId: 'room-123', lastSeen: Date.now(), capabilities: ['webrtc'] },
      ])
    })
    await waitFor(() => { expect(screen.getByText('Phone')).toBeDefined() })
  })

  it('renders sync history events after actions', async () => {
    render(<SyncView />)
    fireEvent.change(screen.getByPlaceholderText('Enter room ID or leave empty to create'), {
      target: { value: 'room-123' },
    })
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => { expect(screen.queryByText('No sync events yet.')).toBeNull() })
  })
})
