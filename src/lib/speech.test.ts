import { describe, it, expect, vi } from 'vitest'
import { isSpeechRecognitionSupported, createSpeechRecognition } from './speech'

describe('speech', () => {
  describe('isSpeechRecognitionSupported', () => {
    it('returns false in non-browser environment', () => {
      // In Node.js environment, window is not defined
      expect(isSpeechRecognitionSupported()).toBe(false)
    })
  })

  describe('createSpeechRecognition', () => {
    it('returns null when speech recognition is not supported', () => {
      const onResult = vi.fn()
      const onError = vi.fn()
      const result = createSpeechRecognition(onResult, onError)
      expect(result).toBeNull()
    })

    it('returns null with custom options when not supported', () => {
      const onResult = vi.fn()
      const onError = vi.fn()
      const result = createSpeechRecognition(onResult, onError, {
        lang: 'de-DE',
        continuous: false,
        interimResults: false,
      })
      expect(result).toBeNull()
    })
  })
})
