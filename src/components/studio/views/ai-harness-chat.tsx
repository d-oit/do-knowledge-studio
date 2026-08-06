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

const sendSuggestion = async (
  setInput: (v: string) => void,
  handleSend: () => void | Promise<void>,
  prompt: string,
) => {
  setInput(prompt)
  await handleSend()
}

const ChatMessageRow = ({ message, reducedMotion }: { message: ChatMessage; reducedMotion: boolean }) => (
  <motion.div
    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
    animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
    transition={reducedMotion ? { duration: 0 } : { duration: 0.25 }}
    className={cn('flex gap-2.5', message.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
  >
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        message.role === 'user'
          ? 'bg-primary text-primary-foreground'
          : 'bg-saffron-soft text-saffron-deep',
      )}
    >
      {message.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
    </div>
    <div
      className={cn(
        'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
        message.role === 'user'
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-muted text-ink rounded-tl-sm',
      )}
    >
      {message.content}
    </div>
  </motion.div>
)

const ChatTypingIndicator = () => (
  <div className="flex gap-2.5">
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron-deep">
      <Bot className="h-3.5 w-3.5" />
    </div>
    <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-[13px] text-ink-mute">
      Thinking…
    </div>
  </div>
)

const ChatSuggestionChips = ({
  suggestions,
  onSend,
}: {
  suggestions: PromptSuggestion[]
  onSend: (prompt: string) => void | Promise<void>
}) => (
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
          onClick={() => { onSend(s.prompt) }}
          className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-ink-soft transition-all hover:border-saffron/40 hover:text-ink press-scale focus-ring min-h-[44px]"
        >
          {s.label}
        </button>
      ))}
    </div>
  </div>
)

const ChatComposer = ({
  input,
  setInput,
  handleSend,
  isLoading,
  cooldownMs,
  augment,
  effectiveModel,
}: {
  input: string
  setInput: (v: string) => void
  handleSend: () => void | Promise<void>
  isLoading: boolean
  cooldownMs: number
  augment: boolean
  effectiveModel: string
}) => (
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
        disabled={isLoading || cooldownMs > 0}
        aria-label="AI agent message"
        className="max-h-24 flex-1 resize-none bg-transparent px-2 py-1 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
      />
      <button
        onClick={() => { handleSend() }}
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
)

export const AiHarnessChatPanel = ({
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
}: ChatPanelProps) => {
  const showSuggestions = suggestions.length > 0 && messages.length <= 1 && !isLoading && input.trim() === ''
  return (
    <div className="flex h-[520px] flex-col rounded-lg border border-border bg-card">
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" aria-atomic="false">
        {messages.map((m) => (
          <ChatMessageRow
            key={`${m.role}:${m.content}`}
            message={m}
            reducedMotion={reducedMotion}
          />
        ))}
        {isLoading && <ChatTypingIndicator />}
      </div>

      {showSuggestions && (
        <ChatSuggestionChips
          suggestions={suggestions}
          onSend={async (prompt) => { await sendSuggestion(setInput, handleSend, prompt) }}
        />
      )}

      <ChatComposer
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        isLoading={isLoading}
        cooldownMs={cooldownMs}
        augment={augment}
        effectiveModel={effectiveModel}
      />
    </div>
  )
}
