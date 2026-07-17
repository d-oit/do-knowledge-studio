'use client'

import { useState, useCallback, useEffect } from 'react'
import { Mic, Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useSpeechRecognition } from '@/lib/use-speech-recognition'
import { parseIntent, formatIntentSummary, type Intent } from '@/lib/nlp'
import { useStudioStore } from '@/lib/studio/store'
import type { EntityType } from '@/lib/studio/types'

interface VoiceCaptureProps {
  onEntityCreated?: (entityId: string) => void
  className?: string
}

export function VoiceCapture({ onEntityCreated, className }: VoiceCaptureProps) {
  const saveEntity = useStudioStore((s) => s.saveEntity)
  const [pendingIntent, setPendingIntent] = useState<Intent | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

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

  const handleTranscript = useCallback((text: string) => {
    const intent = parseIntent(text)
    setPendingIntent(intent)
    if (intent.type === 'create_entity') {
      setEditName(intent.name)
      setEditDescription(intent.description)
    }
  }, [])

  useEffect(() => {
    if (transcript) {
      handleTranscript(transcript)
    }
  }, [transcript, handleTranscript])

  const handleConfirm = useCallback(() => {
    if (!pendingIntent || pendingIntent.type !== 'create_entity') return

    const entity = {
      id: crypto.randomUUID(),
      name: editName || pendingIntent.name,
      type: pendingIntent.entityType as EntityType,
      description: editDescription || pendingIntent.description,
      content: '',
      tags: pendingIntent.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      links: [],
    }

    saveEntity(entity)
    toast.success(`Created ${entity.type}: ${entity.name}`)
    onEntityCreated?.(entity.id)
    setPendingIntent(null)
    setEditName('')
    setEditDescription('')
    reset()
  }, [pendingIntent, editName, editDescription, saveEntity, onEntityCreated, reset])

  const handleDismiss = useCallback(() => {
    setPendingIntent(null)
    setEditName('')
    setEditDescription('')
    reset()
  }, [reset])

  const handleClick = useCallback(() => {
    if (isListening) {
      stop()
    } else {
      reset()
      setPendingIntent(null)
      start()
    }
  }, [isListening, stop, reset, start])

  if (!isSupported) return null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          disabled={isListening}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-ring',
            isListening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-muted text-ink-faint hover:bg-border hover:text-ink',
          )}
          aria-label={isListening ? 'Recording...' : 'Start voice capture'}
        >
          {isListening ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>
        {isListening && interimTranscript && (
          <span className="max-w-[300px] truncate text-[13px] text-ink-faint italic">
            {interimTranscript}
          </span>
        )}
      </div>

      {pendingIntent && !isListening && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-[12px] font-medium text-ink">
            {formatIntentSummary(pendingIntent)}
          </div>

          {pendingIntent.type === 'create_entity' && (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => { setEditName(e.target.value) }}
                placeholder="Entity name"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
              />
              <textarea
                value={editDescription}
                onChange={(e) => { setEditDescription(e.target.value) }}
                placeholder="Description (optional)"
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
              />
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-all hover:opacity-90 press-scale focus-ring"
            >
              <Check className="h-3.5 w-3.5" />
              Confirm
            </button>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[12px] text-red-500">{error}</p>
      )}
    </div>
  )
}
