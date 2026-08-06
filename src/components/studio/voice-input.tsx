'use client'

import { Mic, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeechRecognition } from '@/lib/use-speech-recognition'
import { useEffect, useState, useCallback } from 'react'
import { parseIntent, formatIntentSummary, type Intent } from '@/lib/nlp'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  onIntent?: (intent: Intent) => void
  className?: string
  disabled?: boolean
  showIntentPreview?: boolean
}

/** Toggle button for browser speech recognition with live interim transcript display. */
export function VoiceInput({
  onTranscript,
  onIntent,
  className,
  disabled,
  showIntentPreview = false,
}: VoiceInputProps) {
  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  } = useSpeechRecognition({ continuous: true, interimResults: true })

  const [lastIntent, setLastIntent] = useState<Intent | null>(null)

  useEffect(() => {
    if (transcript) {
      onTranscript(transcript)
      if (onIntent) {
        const intent = parseIntent(transcript)
        setLastIntent(intent)
        onIntent(intent)
      }
    }
  }, [transcript, onTranscript, onIntent])

  useEffect(() => {
    if (error) {
      console.error('Speech recognition error:', error)
    }
  }, [error])

  const handleClick = useCallback(() => {
    if (isListening) {
      stop()
    } else {
      reset()
      setLastIntent(null)
      start()
    }
  }, [isListening, stop, reset, start])

  if (!isSupported) return null

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors focus-ring',
          isListening
            ? 'bg-red-500 text-white animate-pulse'
            : 'text-ink-faint hover:bg-border hover:text-ink',
          disabled && 'opacity-40',
        )}
        aria-label={isListening ? 'Stop recording' : 'Start voice input'}
      >
        {isListening ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {isListening && interimTranscript && (
        <span className="max-w-[200px] truncate text-[12px] text-ink-faint italic">
          {interimTranscript}
        </span>
      )}
      {showIntentPreview && lastIntent && !isListening && (
        <span className="flex items-center gap-1 text-[11px] text-saffron-deep">
          <Sparkles className="h-3 w-3" />
          {formatIntentSummary(lastIntent)}
        </span>
      )}
    </div>
  )
}
