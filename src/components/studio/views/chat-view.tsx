'use client'

import { useStudioStore } from '@/lib/studio/store'
import { Send, Sparkles, Trash2, Bot, User, Quote, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const SUGGESTIONS = [
  { label: 'Summarize recent projects', query: 'Give me a summary of the projects in my library.' },
  { label: 'Key people', query: 'Who are the key people in my knowledge base?' },
  { label: 'What is TRIZ useful for?', query: 'What is the TRIZ contradiction matrix useful for?' },
]

export function ChatView() {
  const { chat, sendMessage } = useStudioStore()
  const [input, setInput] = useState('')
  const [showCitations, setShowCitations] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const handleSend = (text?: string) => {
    const content = (text ?? input).trim()
    if (!content) return
    sendMessage(content)
    setInput('')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-5">
          {chat.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
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
              <div className={cn('max-w-[80%] space-y-2', m.role === 'user' && 'items-end')}>
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

                {/* Citations */}
                {m.citations && m.citations.length > 0 && (
                  <div className="rounded-lg border border-dashed border-saffron/40 bg-saffron-soft/30 p-2.5">
                    <button
                      onClick={() => setShowCitations(showCitations === m.id ? null : m.id)}
                      className="flex w-full items-center gap-1.5 text-[11px] font-semibold text-saffron-deep"
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
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-2 space-y-1.5 overflow-hidden"
                        >
                          {m.citations.map((c, i) => (
                            <div
                              key={i}
                              className="flex gap-2 rounded-md bg-background/60 p-2 text-[11px]"
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-saffron text-[9px] font-bold text-white">
                                {i + 1}
                              </span>
                              <div>
                                <div className="font-semibold text-ink">{c.entityName}</div>
                                <div className="text-ink-mute">{c.snippet}</div>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Suggestions */}
      {chat.length <= 1 && (
        <div className="border-t border-border bg-muted/20 px-5 py-3 lg:px-10">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-medium text-ink-faint">
              <Sparkles className="h-3 w-3" />
              Try:
            </span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => handleSend(s.query)}
                className="rounded-full border border-border bg-background px-3 py-1 text-[12px] font-medium text-ink-soft transition-all hover:border-saffron/40 hover:text-ink focus-ring"
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask about your library, or request a synthesis…"
              rows={1}
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-ink-faint">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Local search active
              </span>
              <span>·</span>
              <span>Enter to send · Shift+Enter for newline</span>
            </div>
            <button className="flex items-center gap-1 transition-colors hover:text-red-500">
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
