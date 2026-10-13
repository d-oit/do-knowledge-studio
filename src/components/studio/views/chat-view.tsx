'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useStudioStore } from '@/lib/studio/store'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { cn } from '@/lib/utils'
import { VIEW_CONTAINER_CLASS, ConfirmDialog } from '../ui/shared-primitives'
import { translate as confirmT } from '@/lib/i18n/messages/confirm'
import {
  WelcomePanel,
  MessageList,
  SuggestionsBar,
  InputBar,
  TypingIndicator,
  CitationDisclosure,
} from './chat-subcomponents'

// Re-export subcomponents for full backwards compatibility with tests and consumers
export {
  WelcomePanel,
  MessageList,
  SuggestionsBar,
  InputBar,
  TypingIndicator,
  CitationDisclosure,
}

/** Debounce delay (ms) before a message is dispatched to the engine. */
const SEND_DEBOUNCE_MS = 300

/** Local-first chat view with BM25 search, citations, and voice input. */
export const ChatView = () => {
  const chat = useStudioStore((s) => s.chat)
  const chatLoading = useStudioStore((s) => s.chatLoading)
  const sendMessage = useStudioStore((s) => s.sendMessage)
  const clearChat = useStudioStore((s) => s.clearChat)
  const setView = useStudioStore((s) => s.setView)
  const selectEntity = useStudioStore((s) => s.selectEntity)
  const reducedMotion = useReducedMotion()
  const [input, setInput] = useState('')
  const [showCitations, setShowCitations] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat, chatLoading])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const sendMessageDebounced = useCallback(
    (content: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        sendMessage(content)
        setInput('')
        inputRef.current?.focus()
        debounceTimerRef.current = null
      }, SEND_DEBOUNCE_MS)
    },
    [sendMessage],
  )

  const handleSend = (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || chatLoading) return
    sendMessageDebounced(content)
  }

  const handleCitationClick = (entityId: string) => {
    selectEntity(entityId)
    setView('editor')
  }

  const handleClear = () => {
    if (chat.length === 0) return
    setShowClearConfirm(true)
  }

  const confirmClear = () => {
    clearChat()
    setShowCitations(null)
    setShowClearConfirm(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div tabIndex={0} className={cn('flex-1 overflow-y-auto', VIEW_CONTAINER_CLASS)}>
        <div className="mx-auto max-w-3xl space-y-5">
          {chat.length === 0 && !chatLoading ? (
            <WelcomePanel reducedMotion={reducedMotion} onSend={handleSend} />
          ) : (
            <MessageList
              chat={chat}
              reducedMotion={reducedMotion}
              showCitations={showCitations}
              onToggleCitations={(id) => {
                setShowCitations(showCitations === id ? null : id)
              }}
              onCitationClick={handleCitationClick}
            />
          )}

          {/* Typing indicator */}
          {chatLoading && <TypingIndicator reducedMotion={reducedMotion} />}

          <div ref={endRef} />
        </div>
      </div>

      {/* Suggestions (below messages, above input) */}
      {chat.length <= 1 && !chatLoading && <SuggestionsBar onSend={handleSend} />}

      {/* Input */}
      <InputBar
        input={input}
        setInput={setInput}
        chatLoading={chatLoading}
        onSend={() => {
          handleSend()
        }}
        onClear={handleClear}
        canClear={chat.length > 0}
        inputRef={inputRef}
      />

      <ConfirmDialog
        open={showClearConfirm}
        onConfirm={confirmClear}
        onCancel={() => { setShowClearConfirm(false) }}
        title={confirmT('confirm.clearChat.title')}
        body={confirmT('confirm.clearChat.body')}
        confirmLabel={confirmT('confirm.clearChat.confirm')}
        destructive
      />
    </div>
  )
}
