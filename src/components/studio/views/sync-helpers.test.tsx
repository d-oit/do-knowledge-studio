import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { generateRoomId, SyncStatusCard } from './sync-helpers'
import type { PeerInfo } from '@/lib/sync/discovery'

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('../qr-pairing', () => ({
  QRDisplay: ({ roomId }: { roomId: string }) => <div data-testid="qr-display">{roomId}</div>,
  QRScanner: ({ onScan }: { onScan: (roomId: string) => void }) => (
    <button data-testid="qr-scanner" onClick={() => onScan('scanned-room')}>Scan</button>
  ),
}))

const defaultProps = {
  status: 'disconnected' as const,
  roomId: 'room-123',
  inputRoomId: '',
  onInputChange: vi.fn(),
  onJoin: vi.fn(),
  peerCount: 0,
  syncedEntities: 0,
  syncedClaims: 0,
  pairingMode: 'none' as const,
  onPairingModeChange: vi.fn(),
  discoveredPeers: [] as PeerInfo[],
  onResync: vi.fn(),
  onLeave: vi.fn(),
  onQrScan: vi.fn(),
}

describe('generateRoomId', () => {
  it('generates a 10-character alphanumeric id', () => {
    const id = generateRoomId()
    expect(id).toHaveLength(10)
    expect(id).toMatch(/^[0-9a-z]{10}$/)
  })

  it('generates unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateRoomId()))
    expect(ids.size).toBe(50)
  })
})

describe('SyncStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Connected status with emerald indicator', () => {
    render(<SyncStatusCard {...defaultProps} status="connected" peerCount={2} syncedEntities={5} syncedClaims={3} />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByTestId('synced-entities').textContent).toBe('5')
    expect(screen.getByTestId('synced-claims').textContent).toBe('3')
  })

  it('renders Connecting status', () => {
    render(<SyncStatusCard {...defaultProps} status="connecting" />)
    expect(screen.getByText('Connecting')).toBeInTheDocument()
  })

  it('renders Error status', () => {
    render(<SyncStatusCard {...defaultProps} status="error" />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders Disconnected status with manual join controls', () => {
    render(<SyncStatusCard {...defaultProps} />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
    expect(screen.getByLabelText('Room ID')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument()
  })

  it('calls onJoin when entering text and pressing Enter', () => {
    render(<SyncStatusCard {...defaultProps} />)
    const input = screen.getByLabelText('Room ID')
    fireEvent.change(input, { target: { value: 'abc123' } })
    expect(defaultProps.onInputChange).toHaveBeenCalledWith('abc123')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(defaultProps.onJoin).toHaveBeenCalled()
  })

  it('toggles QR display mode', () => {
    render(<SyncStatusCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show QR Code' }))
    expect(defaultProps.onPairingModeChange).toHaveBeenCalledWith('display')
  })

  it('toggles QR scan mode', () => {
    render(<SyncStatusCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR Code' }))
    expect(defaultProps.onPairingModeChange).toHaveBeenCalledWith('scan')
  })

  it('shows QR display when pairingMode is display', () => {
    render(<SyncStatusCard {...defaultProps} pairingMode="display" />)
    expect(screen.getByTestId('qr-display')).toBeInTheDocument()
  })

  it('shows QR scanner when pairingMode is scan and forwards scanned room id', () => {
    render(<SyncStatusCard {...defaultProps} pairingMode="scan" />)
    fireEvent.click(screen.getByTestId('qr-scanner'))
    expect(defaultProps.onQrScan).toHaveBeenCalledWith('scanned-room')
  })

  it('shows discovered peers with capabilities', () => {
    const peers: PeerInfo[] = [
      { deviceId: 'dev-1', deviceName: 'Laptop', roomId: 'room-123', lastSeen: Date.now(), capabilities: ['read', 'write'] },
    ]
    render(<SyncStatusCard {...defaultProps} status="connected" discoveredPeers={peers} />)
    expect(screen.getByText('Laptop')).toBeInTheDocument()
    expect(screen.getByText('read, write')).toBeInTheDocument()
  })

  it('calls onResync and onLeave from connected state', () => {
    render(<SyncStatusCard {...defaultProps} status="connected" />)
    fireEvent.click(screen.getByRole('button', { name: /Re-sync/ }))
    expect(defaultProps.onResync).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Leave/ }))
    expect(defaultProps.onLeave).toHaveBeenCalled()
  })

  it('copies room id to clipboard', () => {
    const writeText = vi.fn(async () => undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<SyncStatusCard {...defaultProps} status="connected" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy room ID' }))
    expect(writeText).toHaveBeenCalledWith('room-123')
  })
})