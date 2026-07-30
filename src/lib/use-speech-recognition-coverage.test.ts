import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from './use-speech-recognition'

// Mock recognizer that exposes start/stop and callback setters
function createMockRecognizer() {
  const handlers: Record<string, ((...args: unknown[]) => void) | null> = {
    onresult: null,
    onerror: null,
    onend: null,
  }
  return {
    start: vi.fn(),
    stop: vi.fn(),
    get onresult() { return handlers.onresult },
    set onresult(fn) { handlers.onresult = fn },
    get onerror() { return handlers.onerror },
    set onerror(fn) { handlers.onerror = fn },
    get onend() { return handlers.onend },
    set onend(fn) { handlers.onend = fn },
    // Expose handlers for test manipulation
    _handlers: handlers,
  }
}

let mockRecognizer: ReturnType<typeof createMockRecognizer>
let _supported = true

vi.mock('./speech', () => ({
  isSpeechRecognitionSupported: () => _supported,
  createSpeechRecognition: (onResult: unknown, onError: unknown, _options?: unknown) => {
    // Wire the callbacks to the mock recognizer's _handlers
    if (mockRecognizer._handlers) {
      mockRecognizer._handlers.onresult = onResult as (...args: unknown[]) => void
      mockRecognizer._handlers.onerror = onError as (...args: unknown[]) => void
    }
    return mockRecognizer
  },
}))

describe('useSpeechRecognition — branch coverage', () => {
  beforeEach(() => {
    _supported = true
    mockRecognizer = createMockRecognizer()
  })

  afterEach(() => {
    _supported = true
  })

  // ── Supported path ─────────────────────────────────────────────────

  it('start creates recognition and sets isListening', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })
    expect(mockRecognizer.start).toHaveBeenCalled()
    expect(result.current.isListening).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('start cleans up handlers and creates new recognition', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })
    expect(mockRecognizer.start).toHaveBeenCalledTimes(1)

    // Starting again should nullify old handlers and create new
    act(() => { result.current.start() })
    expect(mockRecognizer.start).toHaveBeenCalledTimes(2)
    expect(result.current.isListening).toBe(true)
  })

  // ── handleResult branches ──────────────────────────────────────────

  it('handleResult with isFinal=true appends to transcript', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })

    // Simulate a final result via the mock recognizer's onresult
    const handler = mockRecognizer._handlers.onresult as ((r: {
      transcript: string
      confidence: number
      isFinal: boolean
    }) => void) | undefined

    act(() => {
      handler?.({ transcript: 'Hello', confidence: 0.9, isFinal: true })
    })
    expect(result.current.transcript).toBe('Hello')
    expect(result.current.interimTranscript).toBe('')

    // Second final result should append
    act(() => {
      handler?.({ transcript: 'world', confidence: 0.8, isFinal: true })
    })
    expect(result.current.transcript).toBe('Hello world')
  })

  it('handleResult with isFinal=false sets interimTranscript', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })

    const handler = mockRecognizer._handlers.onresult as ((r: {
      transcript: string
      confidence: number
      isFinal: boolean
    }) => void) | undefined

    act(() => {
      handler?.({ transcript: 'interim text', confidence: 0.5, isFinal: false })
    })
    expect(result.current.interimTranscript).toBe('interim text')
    expect(result.current.transcript).toBe('')
  })

  // ── handleError branch ─────────────────────────────────────────────

  it('handleError sets error and stops listening', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })
    expect(result.current.isListening).toBe(true)

    // Trigger the onerror callback
    const handler = mockRecognizer._handlers.onerror as ((msg: string) => void) | undefined
    act(() => {
      handler?.('No speech detected')
    })
    expect(result.current.error).toBe('No speech detected')
    expect(result.current.isListening).toBe(false)
  })

  // ── onend branch ───────────────────────────────────────────────────

  it('onend sets isListening to false', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })
    expect(result.current.isListening).toBe(true)

    const handler = mockRecognizer._handlers.onend as (() => void) | undefined
    act(() => {
      handler?.()
    })
    expect(result.current.isListening).toBe(false)
  })

  // ── stop branches ──────────────────────────────────────────────────

  it('stop calls recognizer.stop when listening', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })
    expect(result.current.isListening).toBe(true)

    act(() => { result.current.stop() })
    expect(mockRecognizer.stop).toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
  })

  it('stop does nothing when not listening', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.stop() })
    expect(result.current.isListening).toBe(false)
  })

  // ── start throws ───────────────────────────────────────────────────

  it('start handles recognizer.start throwing', () => {
    mockRecognizer.start.mockImplementationOnce(() => {
      throw new Error('Permission denied')
    })

    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })
    expect(result.current.error).toBe('Permission denied')
    expect(result.current.isListening).toBe(false)
  })

  it('start handles non-Error throw', () => {
    mockRecognizer.start.mockImplementationOnce(() => {
      throw 'string error'
    })

    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })
    expect(result.current.error).toBe('Failed to start')
    expect(result.current.isListening).toBe(false)
  })

  // ── reset branch ───────────────────────────────────────────────────

  it('reset clears transcript, interimTranscript, and error', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start() })
    const handler = mockRecognizer._handlers.onresult as ((r: {
      transcript: string
      confidence: number
      isFinal: boolean
    }) => void) | undefined

    act(() => {
      handler?.({ transcript: 'Hello', confidence: 0.9, isFinal: true })
      handler?.({ transcript: 'interim', confidence: 0.5, isFinal: false })
    })

    act(() => { result.current.reset() })
    expect(result.current.transcript).toBe('')
    expect(result.current.interimTranscript).toBe('')
    expect(result.current.isListening).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // ── isSupported ────────────────────────────────────────────────────

  it('isSupported returns false when speech recognition not available', () => {
    _supported = false
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isSupported).toBe(false)
  })
})
