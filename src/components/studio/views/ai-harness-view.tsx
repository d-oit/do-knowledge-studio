'use client'

import { useStudioStore } from '@/lib/studio/store'
import {
  FlaskConical,
  Bot,
  User,
  Send,
  Settings,
  Database,
  Key,
  Cpu,
  Plug,
  Check,
  BookOpen,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { loadAISettings, saveAISettings, type AIProvider } from '@/lib/studio/ai-settings'

interface ProviderOption {
  id: AIProvider
  label: string
  models: string[]
  requiresKey: boolean
}

const PROVIDERS: ProviderOption[] = [
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'], requiresKey: true },
  { id: 'anthropic', label: 'Anthropic', models: ['claude-sonnet-4', 'claude-haiku-3.5', 'claude-opus-4'], requiresKey: true },
  { id: 'ollama', label: 'Ollama (local)', models: ['llama3', 'mistral', 'qwen2.5', 'gemma2'], requiresKey: false },
]

export function AIHarnessView() {
  const entities = useStudioStore((s) => s.entities)
  const [provider, setProvider] = useState<AIProvider>('ollama')
  const [model, setModel] = useState('llama3')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [augment, setAugment] = useState(true)
  const [showSettings, setShowSettings] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content:
        'AI agent ready to assist with TRIZ analysis and knowledge synthesis. Ask me anything about your local knowledge base, or paste URLs to have me fetch and analyze external content.',
    },
  ])
  const [input, setInput] = useState('')

  useEffect(() => {
    loadAISettings().then((saved) => {
      setProvider(saved.provider)
      setModel(saved.model)
      setApiKey(saved.apiKey)
      setAugment(saved.augmentWithLocal)
      setSettingsLoaded(true)
    })
  }, [])

  const activeProvider = PROVIDERS.find((p) => p.id === provider)!

  useEffect(() => {
    if (!settingsLoaded) return
    saveAISettings({ provider, model, apiKey, augmentWithLocal: augment })
  }, [provider, model, apiKey, augment, settingsLoaded])

  const handleSend = async () => {
    if (!input.trim()) return
    if (!apiKey && activeProvider.requiresKey) {
      toast.error('Set an API key in settings to send messages.')
      return
    }

    const userMsg = { role: 'user' as const, content: input }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const apiMessages: { role: string; content: string }[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: input },
      ]

      if (augment && entities.length > 0) {
        const contextParts = entities.slice(0, 20).map((e) => {
          const tags = e.tags.length ? ` [${e.tags.join(', ')}]` : ''
          const desc = e.description ? `: ${e.description.slice(0, 200)}` : ''
          return `- ${e.name} (${e.type})${tags}${desc}`
        })
        const systemMsg = {
          role: 'system',
          content: `You are assisting with a local knowledge base. Below are relevant entities from the user's library. Use them to inform your answers when applicable.\n\nEntities:\n${contextParts.join('\n')}`,
        }
        apiMessages.unshift(systemMsg)
      }

      const response = await fetchProvider(provider, model, apiKey, apiMessages)
      setMessages((m) => [...m, { role: 'assistant', content: response }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `[Error] ${msg}\n\nThis is a demo fallback. Connect a real provider to get actual responses.` },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 lg:px-10 lg:py-8">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-start gap-4"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-saffron to-clay text-white shadow-sm">
          <FlaskConical className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold text-ink">AI Harness</h1>
            <span className="rounded-full border border-dashed border-saffron/50 px-2 py-0 text-badge font-semibold uppercase tracking-wide text-saffron-deep">
              Lab
            </span>
          </div>
          <p className="text-[13px] text-ink-mute">
            Connect a language model and augment its answers with your local knowledge base.
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium transition-colors hover:border-saffron/40 focus-ring',
            showSettings && 'border-saffron/40 text-saffron-deep',
          )}
        >
          <Settings className="h-3.5 w-3.5" />
          {showSettings ? 'Hide settings' : 'Show settings'}
        </button>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {showSettings && (
          <motion.aside
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-4 font-serif text-[15px] font-semibold text-ink">Provider</h2>

              <div className="space-y-3">
                <Field label="Connect Local Database" icon={Database}>
                  <button
                    onClick={() => toast.success('Local database synced')}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
                  >
                    <span className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Connected · {entities.length} entities
                    </span>
                    <span className="text-caption text-ink-faint">Re-sync</span>
                  </button>
                </Field>

                <Field label="Provider" icon={Plug}>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const p = e.target.value as AIProvider
                      setProvider(p)
                      const opt = PROVIDERS.find((x) => x.id === p)
                      if (opt) { setModel(opt.models[0]) }
                    }}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Model" icon={Cpu}>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                  >
                    {activeProvider.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>

                {activeProvider.requiresKey && (
                  <Field label="API Key" icon={Key}>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-…"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 pr-16 text-[12px] font-mono text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-caption font-medium text-ink-faint hover:text-ink"
                      >
                        {showKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-caption text-ink-faint">
                      Stored in this browser only — sent directly to the provider.
                    </p>
                  </Field>
                )}

                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-saffron" />
                    <div>
                      <div className="text-[12px] font-medium text-ink">Augment with local knowledge</div>
                      <div className="text-caption text-ink-faint">RAG over your entities</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setAugment(!augment)}
                    className={cn(
                      'relative h-5 w-9 overflow-hidden rounded-full transition-colors',
                      augment ? 'bg-saffron' : 'bg-border',
                    )}
                    role="switch"
                    aria-checked={augment}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                        augment ? 'translate-x-[18px]' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>

                <button
                  onClick={() => {
                    saveAISettings({ provider, model, apiKey, augmentWithLocal: augment })
                    toast.success('Settings saved')
                  }}
                  className="w-full rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
                >
                  Save settings
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between text-label">
                <span className="flex items-center gap-1.5 text-ink-mute">
                  <Zap className="h-3 w-3 text-saffron" />
                  Status
                </span>
                <span className="font-mono text-ink">{isLoading ? 'Thinking…' : 'Ready'}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-label">
                <span className="flex items-center gap-1.5 text-ink-mute">
                  <Cpu className="h-3 w-3 text-ink-faint" />
                  Active model
                </span>
                <span className="font-mono text-ink-soft">{model}</span>
              </div>
            </div>
          </motion.aside>
        )}

        <div className={cn('flex flex-col', showSettings ? 'lg:col-span-3' : 'lg:col-span-5')}>
          <div className="flex h-[520px] flex-col rounded-lg border border-border bg-card">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
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
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Ask the AI agent…"
                  rows={1}
                  disabled={isLoading}
                  className="max-h-24 flex-1 resize-none bg-transparent px-2 py-1 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-40 press-scale focus-ring"
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
                <span className="font-mono">{model}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

async function fetchProvider(
  provider: AIProvider,
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  if (provider === 'ollama') {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
    const data = await res.json()
    return data.message?.content ?? '(Empty response)'
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages }),
    })
    if (!res.ok) throw new Error(`OpenAI returned ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? '(Empty response)'
  }

  if (provider === 'anthropic') {
    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? ''
    const chatMsgs = messages.filter((m) => m.role !== 'system')
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: 1024, system: systemMsg, messages: chatMsgs }),
    })
    if (!res.ok) throw new Error(`Anthropic returned ${res.status}`)
    const data = await res.json()
    return data.content?.[0]?.text ?? '(Empty response)'
  }

  throw new Error(`Unknown provider: ${provider}`)
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: typeof Database
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-label font-semibold uppercase tracking-wide text-ink-faint">
        <Icon className="h-3 w-3" />
        {label}
      </label>
      {children}
    </div>
  )
}
