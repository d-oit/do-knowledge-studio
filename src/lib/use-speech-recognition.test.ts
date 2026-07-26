import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from './use-speech-recognition'

// Mock the speech module
vi.mock('./speech', () => ({
  isSpeechRecognitionSupported: vi.fn(() => false),
  createSpeechRecognition: vi.fn(() => null),
}))

describe('useSpeechRecognition', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useSpeechRecognition())

    expect(result.current.isSupported).toBe(false)
    expect(result.current.isListening).toBe(false)
    expect(result.current.transcript).toBe('')
    expect(result.current.interimTranscript).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('start sets error when not supported', async () => {
    const { result } = renderHook(() => useSpeechRecognition())

    await act(async () => {
      result.current.start()
    })

    expect(result.current.error).toBe('Speech recognition is not supported in this browser')
    expect(result.current.isListening).toBe(false)
  })

  it('stop does nothing when not listening', () => {
    const { result } = renderHook(() => useSpeechRecognition())

    act(() => {
      result.current.stop()
    })

    expect(result.current.isListening).toBe(false)
  })

  it('reset clears all state', async () => {
    const { result } = renderHook(() => useSpeechRecognition())

    await act(async () => {
      result.current.start()
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.isListening).toBe(false)
    expect(result.current.transcript).toBe('')
    expect(result.current.interimTranscript).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('accepts custom options', () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({
        lang: 'de-DE',
        continuous: false,
        interimResults: false,
      })
    )

    expect(result.current.isSupported).toBe(false)
    expect(result.current.isListening).toBe(false)
  })
})
