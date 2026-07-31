import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size }: { value: string; size?: number }) => (
    <div data-testid="qr-code" data-value={value} data-size={size}>
      QR: {value}
    </div>
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

const originalMediaDevices = navigator.mediaDevices

import { QRDisplay, QRScanner } from './qr-pairing'

interface MockStream {
  getTracks: () => Array<{ stop: ReturnType<typeof vi.fn> }>
}

const mockStream = (tracks: Array<{ stop: ReturnType<typeof vi.fn> }>): MockStream => ({
  getTracks: () => tracks,
})

const mockMediaDevices = (getUserMedia: ReturnType<typeof vi.fn>) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
    writable: true,
  })
}

const mockBarcodeDetector = (detect: ReturnType<typeof vi.fn>) => {
  class MockBarcodeDetector {
    detect = detect
  }
  Object.defineProperty(window, 'BarcodeDetector', {
    value: MockBarcodeDetector,
    configurable: true,
  })
}

describe('QRDisplay branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows check icon after copying', () => {
    render(<QRDisplay roomId="room-abc-123" />)
    expect(screen.getByTestId('icon').className).not.toContain('text-emerald-500')
    fireEvent.click(screen.getByLabelText('Copy room ID'))
    expect(screen.getByTestId('icon').className).toContain('text-emerald-500')
  })

  it('resets copy icon after 2 seconds', () => {
    vi.useFakeTimers()
    render(<QRDisplay roomId="room-abc-123" />)
    fireEvent.click(screen.getByLabelText('Copy room ID'))
    expect(screen.getByTestId('icon').className).toContain('text-emerald-500')
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByTestId('icon').className).not.toContain('text-emerald-500')
  })
})

describe('QRScanner branch coverage', () => {
  let rafSpy: ReturnType<typeof vi.spyOn>
  let rafCb: FrameRequestCallback | null

  const setupRafCapture = () => {
    rafCb = null
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCb = cb
      return 1
    })
  }

  const setupVideo = (container: HTMLElement) => {
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'play').mockResolvedValue(undefined)
    Object.defineProperty(video, 'videoWidth', { value: 320, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 240, configurable: true })
    return video
  }

  const activateCamera = async () => {
    await act(async () => {
      fireEvent.click(screen.getByText('Tap to scan QR code'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(screen.getByLabelText('Stop camera')).toBeDefined()
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    rafCb = null
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    if (originalMediaDevices === undefined) {
      delete (navigator as { mediaDevices?: unknown }).mediaDevices
    } else {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true,
      })
    }
    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector
  })

  it('activates camera and shows stop button on success', async () => {
    mockMediaDevices(vi.fn().mockResolvedValue(mockStream([])))
    setupRafCapture()
    const { container } = render(<QRScanner onScan={vi.fn()} />)
    setupVideo(container)
    await activateCamera()
    expect(screen.queryByText('Tap to scan QR code')).toBeNull()
    expect(screen.queryByText(/Point camera at QR code/)).toBeNull()
  })

  it('shows error message when camera access rejects with Error', async () => {
    mockMediaDevices(vi.fn().mockRejectedValue(new Error('denied')))
    render(<QRScanner onScan={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByText('Tap to scan QR code'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('denied')).toBeDefined()
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('Camera error: denied')
  })

  it('shows generic error when camera access rejects without Error', async () => {
    mockMediaDevices(vi.fn().mockRejectedValue('boom'))
    render(<QRScanner onScan={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByText('Tap to scan QR code'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('Camera access denied')).toBeDefined()
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('Camera error: Camera access denied')
  })

  it('stops camera via stop button and shows scan prompt again', async () => {
    const tracks = [{ stop: vi.fn() }]
    mockMediaDevices(vi.fn().mockResolvedValue(mockStream(tracks)))
    setupRafCapture()
    const { container } = render(<QRScanner onScan={vi.fn()} />)
    setupVideo(container)
    await activateCamera()
    fireEvent.click(screen.getByLabelText('Stop camera'))
    expect(tracks[0].stop).toHaveBeenCalled()
    expect(screen.getByText('Tap to scan QR code')).toBeDefined()
  })

  it('stops camera on unmount', async () => {
    const tracks = [{ stop: vi.fn() }]
    mockMediaDevices(vi.fn().mockResolvedValue(mockStream(tracks)))
    setupRafCapture()
    const { container, unmount } = render(<QRScanner onScan={vi.fn()} />)
    setupVideo(container)
    await activateCamera()
    unmount()
    expect(tracks[0].stop).toHaveBeenCalled()
  })

  it('unmount without active stream does not throw', () => {
    const { unmount } = render(<QRScanner onScan={vi.fn()} />)
    expect(() => unmount()).not.toThrow()
  })

  it('calls onScan when a QR code is detected', async () => {
    mockMediaDevices(vi.fn().mockResolvedValue(mockStream([])))
    mockBarcodeDetector(vi.fn(() => Promise.resolve([{ rawValue: 'room-1' }])))
    setupRafCapture()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    const onScan = vi.fn()
    const { container } = render(<QRScanner onScan={onScan} />)
    setupVideo(container)
    await activateCamera()
    await act(async () => {
      rafCb?.(1)
    })
    await waitFor(() => {
      expect(onScan).toHaveBeenCalledWith('room-1')
    })
  })

  it('keeps scanning when no barcode is found', async () => {
    mockMediaDevices(vi.fn().mockResolvedValue(mockStream([])))
    mockBarcodeDetector(vi.fn(() => Promise.resolve([])))
    setupRafCapture()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    const onScan = vi.fn()
    const { container } = render(<QRScanner onScan={onScan} />)
    setupVideo(container)
    await activateCamera()
    await act(async () => {
      rafCb?.(1)
    })
    await waitFor(() => {
      expect(rafSpy).toHaveBeenCalledTimes(2)
    })
    expect(onScan).not.toHaveBeenCalled()
  })

  it('reschedules detection when detect rejects', async () => {
    mockMediaDevices(vi.fn().mockResolvedValue(mockStream([])))
    mockBarcodeDetector(vi.fn(() => Promise.reject(new Error('detector failed'))))
    setupRafCapture()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    const onScan = vi.fn()
    const { container } = render(<QRScanner onScan={onScan} />)
    setupVideo(container)
    await activateCamera()
    await act(async () => {
      rafCb?.(1)
    })
    await waitFor(() => {
      expect(rafSpy).toHaveBeenCalledTimes(2)
    })
    expect(onScan).not.toHaveBeenCalled()
  })

  it('reschedules detection when BarcodeDetector is unavailable', async () => {
    mockMediaDevices(vi.fn().mockResolvedValue(mockStream([])))
    setupRafCapture()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    const onScan = vi.fn()
    const { container } = render(<QRScanner onScan={onScan} />)
    setupVideo(container)
    await activateCamera()
    await act(async () => {
      rafCb?.(1)
    })
    await waitFor(() => {
      expect(rafSpy).toHaveBeenCalledTimes(2)
    })
    expect(onScan).not.toHaveBeenCalled()
  })

  it('uses the latest onScan callback after rerender', async () => {
    mockMediaDevices(vi.fn().mockResolvedValue(mockStream([])))
    mockBarcodeDetector(vi.fn(() => Promise.resolve([{ rawValue: 'room-1' }])))
    setupRafCapture()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    const onScanA = vi.fn()
    const onScanB = vi.fn()
    const { container, rerender } = render(<QRScanner onScan={onScanA} />)
    rerender(<QRScanner onScan={onScanB} />)
    setupVideo(container)
    await activateCamera()
    await act(async () => {
      rafCb?.(1)
    })
    await waitFor(() => {
      expect(onScanB).toHaveBeenCalledWith('room-1')
    })
    expect(onScanA).not.toHaveBeenCalled()
  })
})
