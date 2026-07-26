'use client'

import { Bot, User, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { ChatMessage } from '@/lib/ai'
import type { RefObject } from 'react'

interface ChatPanelProps {
  messages: ChatMessage[]
  isLoading: boolean
  input: string
  setInput: (v: string) => void
  handleSend: () => void
  reducedMotion: boolean
  augment: boolean
  effectiveModel: string
  abortRef: RefObject<AbortController | null>
}

export function AiHarnessChatPanel({
  messages,
  isLoading,
  input,
  setInput,
  handleSend,
  reducedMotion,
  augment,
  effectiveModel,
}: ChatPanelProps) {
  return (
    <div className="flex h-[520px] flex-col rounded-lg border border-border bg-card">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.25 }}
            className={cn('flex gap-2.5', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-saffron-soft text-saffron-deep',
              )}
            >
              {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-muted text-ink rounded-tl-sm',
              )}
            >
              {m.content}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron-deep">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-[13px] text-ink-mute">
              Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-1.5 focus-within:border-saffron/40">
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask the AI agent…"
            rows={1}
            disabled={isLoading}
            aria-label="AI agent message"
            className="max-h-24 flex-1 resize-none bg-transparent px-2 py-1 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-40 press-scale focus-ring"
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1 text-caption text-ink-faint">
          <span className="flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            {augment ? 'Augmented with local knowledge' : 'No augmentation'}
          </span>
          <span className="font-mono">{effectiveModel}</span>
        </div>
      </div>
    </div>
  )
}
