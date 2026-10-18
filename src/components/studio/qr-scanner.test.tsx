import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <div data-testid="qr-code" data-value={value}>QR: {value}</div>
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

import { QRScanner } from './qr-pairing'

describe('QRScanner — branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Initial state ──────────────────────────────────────────────────

  it('shows scan prompt when not active', () => {
    render(<QRScanner onScan={vi.fn()} />)
    expect(screen.getByText('Tap to scan QR code')).toBeDefined()
  })

  it('shows instruction text when not active', () => {
    render(<QRScanner onScan={vi.fn()} />)
    expect(screen.getByText(/Point camera at QR code/)).toBeDefined()
  })

  it('video element is always mounted (bug fix: ref available)', () => {
    const { container } = render(<QRScanner onScan={vi.fn()} />)
    const video = container.querySelector('video')
    expect(video).toBeDefined()
    expect(video).toHaveAttribute('playsInline')
  })

  // ── Camera start success ───────────────────────────────────────────

  it('calls getUserMedia on scan button click and shows video', async () => {
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: vi.fn(() => [{ stop: vi.fn() }]),
        }),
      },
    })

    render(<QRScanner onScan={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Tap to scan QR code'))
    })

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
    })
    // Video container should be visible now (not hidden)
    const video = screen.getByLabelText('Stop camera')
    expect(video).toBeDefined()
  })

  it('shows stop camera button when active', async () => {
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: vi.fn(() => [{ stop: vi.fn() }]),
        }),
      },
    })

    render(<QRScanner onScan={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Tap to scan QR code'))
    })

    expect(screen.getByLabelText('Stop camera')).toBeDefined()
  })

  it('clicking stop camera returns to initial state', async () => {
    const trackStop = vi.fn()
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: vi.fn(() => [{ stop: trackStop }]),
        }),
      },
    })

    render(<QRScanner onScan={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Tap to scan QR code'))
    })

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Stop camera'))
    })

    expect(trackStop).toHaveBeenCalled()
    expect(screen.getByText('Tap to scan QR code')).toBeDefined()
  })

  // ── Camera error ───────────────────────────────────────────────────

  it('shows error message when camera access fails', async () => {
    Object.assign(navigator, {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('Camera unavailable')) },
    })

    render(<QRScanner onScan={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Tap to scan QR code'))
    })

    expect(screen.getByText('Camera unavailable')).toBeDefined()
  })

  it('shows fallback message for non-Error camera rejection', async () => {
    Object.assign(navigator, {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue('string error') },
    })

    render(<QRScanner onScan={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Tap to scan QR code'))
    })

    expect(screen.getByText('Camera access denied')).toBeDefined()
  })
})

