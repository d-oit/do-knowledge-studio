'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  isSpeechRecognitionSupported,
  createSpeechRecognition,
  type SpeechRecognitionOptions,
} from './speech'

export interface UseSpeechRecognitionReturn {
  isSupported: boolean
  isListening: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

export function useSpeechRecognition(
  options: SpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition>>(null)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onerror = null
      recognitionRef.current.onend = null
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => { cleanup() }
  }, [cleanup])

  const handleResult = useCallback(
    (result: { transcript: string; confidence: number; isFinal: boolean }) => {
      if (result.isFinal) {
        setTranscript((prev) => (prev ? `${prev} ${result.transcript}` : result.transcript))
        setInterimTranscript('')
      } else {
        setInterimTranscript(result.transcript)
      }
    },
    [],
  )

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg)
    setIsListening(false)
    cleanup()
  }, [cleanup])

  const start = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setError('Speech recognition is not supported in this browser')
      return
    }

    cleanup()
    setError(null)

    const recognition = createSpeechRecognition(
      handleResult,
      handleError,
      optionsRef.current,
    )

    if (!recognition) {
      setError('Failed to create speech recognition')
      return
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
      setIsListening(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start'
      setError(msg)
      cleanup()
    }
  }, [cleanup, handleResult, handleError])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  const reset = useCallback(() => {
    cleanup()
    setIsListening(false)
    setTranscript('')
    setInterimTranscript('')
    setError(null)
  }, [cleanup])

  return {
    isSupported: isSpeechRecognitionSupported(),
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  }
}
