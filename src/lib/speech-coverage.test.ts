import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isSpeechRecognitionSupported, createSpeechRecognition } from './speech'

// ── isSpeechRecognitionSupported with mocked globals ────────────────

describe('isSpeechRecognitionSupported — branch coverage', () => {
  beforeEach(() => {
    delete (window as Record<string, unknown>)['SpeechRecognition']
    delete (window as Record<string, unknown>)['webkitSpeechRecognition']
  })

  it('returns true when SpeechRecognition exists', () => {
    window.SpeechRecognition = vi.fn() as unknown as typeof window.SpeechRecognition
    expect(isSpeechRecognitionSupported()).toBe(true)
  })

  it('returns true when webkitSpeechRecognition exists', () => {
    window.webkitSpeechRecognition = vi.fn() as unknown as typeof window.webkitSpeechRecognition
    expect(isSpeechRecognitionSupported()).toBe(true)
  })

  it('returns false when neither exists', () => {
    expect(isSpeechRecognitionSupported()).toBe(false)
  })
})

// ── createSpeechRecognition with mocked globals ─────────────────────

describe('createSpeechRecognition — branch coverage', () => {
  let mockRecognition: {
    lang: string
    continuous: boolean
    interimResults: boolean
    onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null
    onerror: ((event: { error: string }) => void) | null
    onend: (() => void) | null
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    abort: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockRecognition = {
      lang: '',
      continuous: false,
      interimResults: false,
      onresult: null,
      onerror: null,
      onend: null,
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
    }
    // Constructor function returning mockRecognition — works with `new`
    function MockSpeechRecognition() {
      return mockRecognition
    }
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition
  })

  afterEach(() => {
    delete (window as Record<string, unknown>)['SpeechRecognition']
  })

  it('creates recognition with default options', () => {
    const onResult = vi.fn()
    const onError = vi.fn()
    const result = createSpeechRecognition(onResult, onError)

    expect(result).not.toBeNull()
    expect(result!.lang).toBe('en-US')
    expect(result!.continuous).toBe(true)
    expect(result!.interimResults).toBe(true)
  })

  it('creates recognition with custom options', () => {
    const result = createSpeechRecognition(vi.fn(), vi.fn(), {
      lang: 'de-DE',
      continuous: false,
      interimResults: false,
    })

    expect(result!.lang).toBe('de-DE')
    expect(result!.continuous).toBe(false)
    expect(result!.interimResults).toBe(false)
  });

  it('onresult iterates from end and calls onResult', () => {
    const onResult = vi.fn()
    createSpeechRecognition(onResult, vi.fn())

    // Simulate a results event with 2 entries
    // isFinal is on the SpeechRecognitionResult (the indexable container),
    // NOT on the SpeechRecognitionAlternative (the array element)
    const result0: unknown[] = [{ transcript: 'hello', confidence: 0.9 }]
    ;(result0 as { isFinal?: boolean }).isFinal = true
    const result1: unknown[] = [{ transcript: 'world', confidence: 0.8 }]
    ;(result1 as { isFinal?: boolean }).isFinal = true

    const mockEvent = {
      results: {
        0: result0,
        1: result1,
        length: 2,
      } as unknown as SpeechRecognitionResultList,
    }

    // The onresult callback was set on the mock recognition
    mockRecognition.onresult?.(mockEvent as unknown as { results: SpeechRecognitionResultList })

    // Should iterate from end (index 1 first), so world is first call, hello is second
    expect(onResult).toHaveBeenCalledTimes(2)
    expect(onResult).toHaveBeenNthCalledWith(1, {
      transcript: 'world',
      confidence: 0.8,
      isFinal: true,
    })
    expect(onResult).toHaveBeenNthCalledWith(2, {
      transcript: 'hello',
      confidence: 0.9,
      isFinal: true,
    })
  });

  it('onresult uses isFinal from result', () => {
    const onResult = vi.fn()
    createSpeechRecognition(onResult, vi.fn())

    const interimResult: unknown[] = [{ transcript: 'interim', confidence: 0.5 }]
    ;(interimResult as { isFinal?: boolean }).isFinal = false

    const mockEvent = {
      results: {
        0: interimResult,
        length: 1,
      } as unknown as SpeechRecognitionResultList,
    }

    mockRecognition.onresult?.(mockEvent as unknown as { results: SpeechRecognitionResultList })

    expect(onResult).toHaveBeenCalledWith({
      transcript: 'interim',
      confidence: 0.5,
      isFinal: false,
    })
  })

  it('onerror calls onError for non-aborted errors', () => {
    const onError = vi.fn()
    createSpeechRecognition(vi.fn(), onError)

    mockRecognition.onerror?.({ error: 'no-speech' })

    expect(onError).toHaveBeenCalledWith('Speech recognition error: no-speech')
  })

  it('onerror skips onError for aborted errors', () => {
    const onError = vi.fn()
    createSpeechRecognition(vi.fn(), onError)

    mockRecognition.onerror?.({ error: 'aborted' })

    expect(onError).not.toHaveBeenCalled()
  })

  it('returns null when not supported', () => {
    delete (window as Record<string, unknown>)['SpeechRecognition']
    delete (window as Record<string, unknown>)['webkitSpeechRecognition']

    const result = createSpeechRecognition(vi.fn(), vi.fn())
    expect(result).toBeNull()
  })

  it('uses webkitSpeechRecognition when SpeechRecognition is not available', () => {
    delete (window as Record<string, unknown>)['SpeechRecognition']
    function MockWebkitSpeechRecognition() {
      return mockRecognition
    }
    window.webkitSpeechRecognition = MockWebkitSpeechRecognition as unknown as typeof window.webkitSpeechRecognition

    const result = createSpeechRecognition(vi.fn(), vi.fn())
    expect(result).not.toBeNull()
  })
})
