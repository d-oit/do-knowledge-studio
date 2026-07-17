export interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

export interface SpeechRecognitionOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
}

type SpeechRecognitionCallback = (result: SpeechRecognitionResult) => void
type ErrorCallback = (error: string) => void

interface SpeechRecognitionInstance {
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  continuous: boolean
  interimResults: boolean
  lang: string
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )
}

export function createSpeechRecognition(
  onResult: SpeechRecognitionCallback,
  onError: ErrorCallback,
  options: SpeechRecognitionOptions = {},
): SpeechRecognitionInstance | null {
  if (!isSpeechRecognitionSupported()) return null

  const SpeechRecognitionConstructor =
    window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!SpeechRecognitionConstructor) return null

  const recognition = new SpeechRecognitionConstructor()
  recognition.lang = options.lang ?? 'en-US'
  recognition.continuous = options.continuous ?? true
  recognition.interimResults = options.interimResults ?? true

  recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
    for (let i = event.results.length - 1; i >= 0; i--) {
      const result = event.results[i]
      const transcript = result[0].transcript
      const confidence = result[0].confidence
      onResult({
        transcript,
        confidence,
        isFinal: result.isFinal,
      })
    }
  }

  recognition.onerror = (event: { error: string }) => {
    if (event.error !== 'aborted') {
      onError(`Speech recognition error: ${event.error}`)
    }
  }

  return recognition
}
