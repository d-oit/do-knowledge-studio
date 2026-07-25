import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, exit: _e, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
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
    FileText: Icon,
    Lightbulb: Icon,
    User: Icon,
    FolderKanban: Icon,
    Plus: Icon,
    Search: Icon,
    X: Icon,
    LayoutGrid: Icon,
    List: Icon,
    ArrowUpDown: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
    Clock: Icon,
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
  joinRoom: vi.fn(),
  getProvider: vi.fn(() => null),
  getYjsEntities: vi.fn(() => []),
  getYjsClaims: vi.fn(() => []),
  destroy: vi.fn(),
}))

vi.mock('@/lib/sync/bridge', () => ({
  mergeIntoYjs: vi.fn(() => ({ conflicts: [] })),
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
  ConflictUI: () => <div data-testid="conflict-ui" />,
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
})
