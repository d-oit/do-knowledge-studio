'use client'

import { useStudioStore } from '@/lib/studio/store'
import { Send, Sparkles, Trash2, Bot, User, Quote, ChevronDown, MessageSquare } from 'lucide-react'
import { VoiceInput } from '../voice-input'
import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

const SUGGESTIONS = [
  { label: 'Summarize recent projects', query: 'Give me a summary of the projects in my library.' },
  { label: 'Key people', query: 'Who are the key people in my knowledge base?' },
  { label: 'What is TRIZ useful for?', query: 'What is the TRIZ contradiction matrix useful for?' },
]

function TypingIndicator({ reducedMotion }: { reducedMotion?: boolean }) {
  return (
    <div className="flex gap-3" aria-live="polite" aria-label="Assistant is typing">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron-deep">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full bg-ink-faint [animation-delay:-0.3s]', reducedMotion ? '' : 'animate-bounce')} />
          <span className={cn('h-1.5 w-1.5 rounded-full bg-ink-faint [animation-delay:-0.15s]', reducedMotion ? '' : 'animate-bounce')} />
          <span className={cn('h-1.5 w-1.5 rounded-full bg-ink-faint', reducedMotion ? '' : 'animate-bounce')} />
        </div>
      </div>
    </div>
  )
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function ChatView() {
  const chat = useStudioStore((s) => s.chat)
  const chatLoading = useStudioStore((s) => s.chatLoading)
  const sendMessage = useStudioStore((s) => s.sendMessage)
  const clearChat = useStudioStore((s) => s.clearChat)
  const setView = useStudioStore((s) => s.setView)
  const selectEntity = useStudioStore((s) => s.selectEntity)
  const reducedMotion = useReducedMotion()
  const [input, setInput] = useState('')
  const [showCitations, setShowCitations] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat, chatLoading])

  const handleSend = (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || chatLoading) return
    sendMessage(content)
    setInput('')
    inputRef.current?.focus()
  }

  const handleCitationClick = (entityId: string) => {
    selectEntity(entityId)
    setView('editor')
  }

  const handleClear = () => {
    if (chat.length === 0) return
    clearChat()
    setShowCitations(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-5">
          {chat.length === 0 && !chatLoading ? (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotion ? { duration: 0 } : undefined}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-saffron-soft text-saffron-deep">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="mb-2 font-serif text-lg font-semibold text-ink">
                Ask your library
              </h2>
              <p className="mb-6 max-w-sm text-[14px] text-ink-mute">
                Ask questions about your library. Answers are based on local search — no data leaves your device.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => { handleSend(s.query) }}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-all hover:border-saffron/40 hover:text-ink press-scale focus-ring min-h-[44px]"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            chat.map((m) => (
              <motion.div
                key={m.id}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.25 }}
                className={cn('flex gap-3', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-saffron-soft text-saffron-deep',
                  )}
                >
                  {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                {/* Bubble */}
                <div className={cn('max-w-[80%] space-y-1.5', m.role === 'user' && 'items-end')}>
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-[14px] leading-relaxed',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-card border border-border text-ink rounded-tl-sm',
                    )}
                  >
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>

                  {/* Timestamp */}
                  <p className={cn(
                    'text-caption text-ink-faint',
                    m.role === 'user' ? 'text-right' : 'text-left',
                  )}>
                    {formatTime(m.timestamp)}
                  </p>

                  {/* Citations */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="rounded-lg border border-dashed border-saffron/40 bg-saffron-soft/30 p-2.5">
                      <button
                        onClick={() => { setShowCitations(showCitations === m.id ? null : m.id) }}
                        aria-expanded={showCitations === m.id}
                        className="flex w-full items-center gap-1.5 text-label font-semibold text-saffron-deep min-h-[44px]"
                      >
                        <Quote className="h-3 w-3" />
                        Used {m.citations.length} local {m.citations.length === 1 ? 'item' : 'items'}
                        <ChevronDown
                          className={cn('h-3 w-3 transition-transform', showCitations === m.id && 'rotate-180')}
                        />
                      </button>
                      <AnimatePresence>
                        {showCitations === m.id && (
                          <motion.div
                            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                            transition={reducedMotion ? { duration: 0 } : undefined}
                            className="mt-2 space-y-1.5 overflow-hidden"
                          >
                            {m.citations.map((c, i) => (
                              <button
                                key={i}
                                onClick={() => { handleCitationClick(c.entityId) }}
                                className="flex w-full gap-2 rounded-md bg-background/60 p-2 text-left text-label transition-colors hover:bg-muted focus-ring min-h-[44px]"
                              >
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-saffron text-badge font-bold text-white">
                                  {i + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-ink group-hover:text-saffron-deep">{c.entityName}</div>
                                  <div className="truncate text-ink-mute">{c.snippet}</div>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}

          {/* Typing indicator */}
          {chatLoading && <TypingIndicator reducedMotion={reducedMotion} />}

          <div ref={endRef} />
        </div>
      </div>

      {/* Suggestions (below messages, above input) */}
      {chat.length <= 1 && !chatLoading && (
        <div className="border-t border-border bg-muted/20 px-5 py-3 lg:px-10">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-label font-medium text-ink-faint">
              <Sparkles className="h-3 w-3" />
              Try:
            </span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => { handleSend(s.query) }}
                className="rounded-full border border-border bg-background px-3 py-1 text-[12px] font-medium text-ink-soft transition-all hover:border-saffron/40 hover:text-ink press-scale focus-ring min-h-[44px]"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-background px-5 py-4 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-sm transition-colors focus-within:border-saffron/50">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value.slice(0, 2000)) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask about your library, or request a synthesis…"
              rows={1}
              maxLength={2000}
              disabled={chatLoading}
              aria-label="Chat message"
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
            />
            <VoiceInput
              onTranscript={(text) => { setInput((prev) => prev + ' ' + text) }}
              disabled={chatLoading}
            />
            <button
              onClick={() => { handleSend() }}
              disabled={!input.trim() || chatLoading}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 press-scale focus-ring"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-caption text-ink-faint">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-saffron" />
                Local search active
              </span>
              <span>·</span>
              <span>Enter to send · Shift+Enter for newline</span>
              {input.length > 1800 && (
                <span className={cn('font-mono', input.length >= 2000 ? 'text-clay' : 'text-ink-faint')}>
                  {input.length}/2000
                </span>
              )}
            </div>
            <button
              onClick={handleClear}
              disabled={chat.length === 0}
              className="flex items-center gap-1 transition-colors hover:text-red-500 disabled:opacity-30 disabled:hover:text-red-500 min-h-[44px] focus-ring"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
