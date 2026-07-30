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

  it('shows scan prompt when not active', () => {
    render(<QRScanner onScan={vi.fn()} />)
    expect(screen.getByText('Tap to scan QR code')).toBeDefined()
  })

  it('shows instruction text when not active', () => {
    render(<QRScanner onScan={vi.fn()} />)
    expect(screen.getByText(/Point camera at QR code/)).toBeDefined()
  })

  it('calls getUserMedia on scan button click', async () => {
    const mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: vi.fn(() => [{ stop: vi.fn() }]),
    })
    Object.assign(navigator, { mediaDevices: { getUserMedia: mockGetUserMedia } })

    render(<QRScanner onScan={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Tap to scan QR code'))
    })

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
    })
  })

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

