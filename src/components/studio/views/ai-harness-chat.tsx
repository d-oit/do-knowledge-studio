'use client'

import { Bot, User, Send, Sparkles, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { ChatMessage } from '@/lib/ai'

interface PromptSuggestion {
  label: string
  prompt: string
}

interface ChatPanelProps {
  messages: ChatMessage[]
  isLoading: boolean
  input: string
  setInput: (v: string) => void
  handleSend: () => void | Promise<void>
  reducedMotion: boolean
  augment: boolean
  effectiveModel: string
  cooldownMs?: number
  suggestions?: PromptSuggestion[]
}

const SUGGESTIONS_LABEL = 'Try asking'

function sendSuggestion(setInput: (v: string) => void, handleSend: () => void | Promise<void>, prompt: string) {
  setInput(prompt)
  void handleSend()
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
  cooldownMs = 0,
  suggestions = [],
}: ChatPanelProps) {
  const showSuggestions = suggestions.length > 0 && messages.length <= 1 && !isLoading && input.trim() === ''
  return (
    <div className="flex h-[520px] flex-col rounded-lg border border-border bg-card">
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" aria-atomic="false">
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

      {showSuggestions && (
        <div className="border-t border-border bg-muted/20 px-3 py-2">
          <p className="mb-1.5 flex items-center gap-1 text-label font-semibold uppercase tracking-wide text-ink-faint">
            <Lightbulb className="h-3 w-3 text-saffron" aria-hidden="true" />
            {SUGGESTIONS_LABEL}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => { sendSuggestion(setInput, handleSend, s.prompt) }}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-ink-soft transition-all hover:border-saffron/40 hover:text-ink press-scale focus-ring min-h-[44px]"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-1.5 focus-within:border-saffron/40">
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="Ask the AI agent…"
            rows={1}
            disabled={isLoading || cooldownMs > 0}
            aria-label="AI agent message"
            className="max-h-24 flex-1 resize-none bg-transparent px-2 py-1 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => { void handleSend() }}
            disabled={!input.trim() || isLoading || cooldownMs > 0}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-40 press-scale focus-ring"
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {cooldownMs > 0 && (
          <p className="mt-1 text-center text-[11px] text-amber-600">
            Wait {Math.ceil(cooldownMs / 1000)}s before sending again
          </p>
        )}
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
