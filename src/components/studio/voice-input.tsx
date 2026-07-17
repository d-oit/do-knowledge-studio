'use client'

import { Mic, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeechRecognition } from '@/lib/use-speech-recognition'
import { useEffect } from 'react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  className?: string
  disabled?: boolean
}

export function VoiceInput({ onTranscript, className, disabled }: VoiceInputProps) {
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

  useEffect(() => {
    if (transcript) {
      onTranscript(transcript)
    }
  }, [transcript, onTranscript])

  useEffect(() => {
    if (error) {
      console.error('Speech recognition error:', error)
    }
  }, [error])

  if (!isSupported) return null

  const handleClick = () => {
    if (isListening) {
      stop()
    } else {
      reset()
      start()
    }
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-ring',
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
    </div>
  )
}
