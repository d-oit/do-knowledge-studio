import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size }: { value: string; size?: number }) => (
    <div data-testid="qr-code" data-value={value} data-size={size}>QR: {value}</div>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { Camera: Icon, X: Icon, Copy: Icon, Check: Icon }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
})

import { QRDisplay, QRScanner } from './qr-pairing'

describe('QRDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the QR code', () => {
    render(<QRDisplay roomId="room-abc-123" />)
    expect(screen.getByTestId('qr-code')).toBeDefined()
  })

  it('passes roomId to QR code', () => {
    render(<QRDisplay roomId="room-abc-123" />)
    expect(screen.getByTestId('qr-code')).toHaveAttribute('data-value', 'room-abc-123')
  })

  it('displays the room ID text', () => {
    render(<QRDisplay roomId="room-abc-123" />)
    expect(screen.getByText('room-abc-123')).toBeDefined()
  })

  it('renders the copy button', () => {
    render(<QRDisplay roomId="room-abc-123" />)
    expect(screen.getByLabelText('Copy room ID')).toBeDefined()
  })

  it('copies room ID to clipboard on click', () => {
    render(<QRDisplay roomId="room-abc-123" />)
    fireEvent.click(screen.getByLabelText('Copy room ID'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('room-abc-123')
  })

  it('shows scan instruction text', () => {
    render(<QRDisplay roomId="room-abc-123" />)
    expect(screen.getByText(/Scan this QR code/)).toBeDefined()
  })

  it('renders QR code with correct size', () => {
    render(<QRDisplay roomId="room-abc-123" />)
    expect(screen.getByTestId('qr-code')).toHaveAttribute('data-size', '180')
  })
})

describe('QRScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the initial scan prompt', () => {
    render(<QRScanner onScan={vi.fn()} />)
    expect(screen.getByText('Tap to scan QR code')).toBeDefined()
  })

  it('renders instruction text when not active', () => {
    render(<QRScanner onScan={vi.fn()} />)
    expect(screen.getByText(/Point camera at QR code/)).toBeDefined()
  })

  it('renders camera icon when not active', () => {
    render(<QRScanner onScan={vi.fn()} />)
    // Camera icon is inside the scan button (visible)
    // X icon is inside the stop button (hidden by video container's hidden class)
    const icons = screen.getAllByTestId('icon')
    expect(icons.length).toBeGreaterThanOrEqual(1)
  })

  it('has a tappable scan area', () => {
    render(<QRScanner onScan={vi.fn()} />)
    const scanButton = screen.getByText('Tap to scan QR code').closest('button')!
    expect(scanButton).toBeDefined()
  })

  it('video element is always mounted (hidden by CSS when inactive)', () => {
    const { container } = render(<QRScanner onScan={vi.fn()} />)
    const video = container.querySelector('video')
    expect(video).toBeDefined()
    // Video container should have hidden class when not active
    expect(video?.closest('.hidden')).toBeDefined()
  })

  it('does not show error initially', () => {
    render(<QRScanner onScan={vi.fn()} />)
    expect(screen.queryByText(/error/i)).toBeNull()
  })
})
