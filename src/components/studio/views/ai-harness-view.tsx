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
  RefreshCw,
  Globe,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { loadAISettings, saveAISettings, type AIProvider } from '@/lib/studio/ai-settings'
import {
  sendChatStream,
  fetchOllamaModels,
  buildMessages,
  type ChatMessage,
} from '@/lib/ai'
import {
  PROVIDER_LABELS,
  OPENROUTER_DEFAULT_MODELS,
  OLLAMA_DEFAULT_MODELS,
  DEFAULT_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
} from '@/lib/ai/types'

interface ProviderOption {
  id: AIProvider
  label: string
  models: string[]
  requiresKey: boolean
}

const PROVIDERS: ProviderOption[] = [
  { id: 'openrouter', label: PROVIDER_LABELS.openrouter, models: OPENROUTER_DEFAULT_MODELS, requiresKey: true },
  { id: 'ollama', label: PROVIDER_LABELS.ollama, models: OLLAMA_DEFAULT_MODELS, requiresKey: false },
]

export function AIHarnessView() {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const [provider, setProvider] = useState<AIProvider>('openrouter')
  const [model, setModel] = useState('openrouter/free')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [augment, setAugment] = useState(true)
  const [ollamaCpuOnly, setOllamaCpuOnly] = useState(false)
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(DEFAULT_OLLAMA_BASE_URL)
  const [allowWebResearch, setAllowWebResearch] = useState(false)
  const [customModel, setCustomModel] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<string[]>(OLLAMA_DEFAULT_MODELS)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'AI agent ready to assist with knowledge synthesis. Ask me anything about your local knowledge base.',
    },
  ])
  const [input, setInput] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    loadAISettings().then((saved) => {
      setProvider(saved.provider)
      setModel(saved.model)
      setApiKey(saved.apiKey)
      setAugment(saved.augmentWithLocal)
      setOllamaCpuOnly(saved.ollamaCpuOnly)
      setAllowWebResearch(saved.allowWebResearch)
      setOllamaBaseUrl(saved.ollamaBaseUrl)
      setSettingsLoaded(true)
    })
  }, [])

  const activeProvider = PROVIDERS.find((p) => p.id === provider)!

  useEffect(() => {
    if (!settingsLoaded) return
    saveAISettings({
      provider,
      model,
      apiKey,
      augmentWithLocal: augment,
      ollamaCpuOnly,
      allowWebResearch,
      ollamaBaseUrl,
    })
  }, [provider, model, apiKey, augment, ollamaCpuOnly, allowWebResearch, ollamaBaseUrl, settingsLoaded])

  const handleRefreshOllamaModels = useCallback(async () => {
    try {
      const models = await fetchOllamaModels(ollamaBaseUrl)
      setOllamaModels(models.length > 0 ? models : OLLAMA_DEFAULT_MODELS)
      toast.success(`Found ${models.length} Ollama models`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Failed to fetch Ollama models: ${msg}`)
    }
  }, [ollamaBaseUrl])

  const effectiveModel = customModel.trim() || model

  const handleSend = async () => {
    if (!input.trim()) return
    if (!apiKey && activeProvider.requiresKey) {
      toast.error('Set an API key in settings to send messages.')
      return
    }

    const userMsg: ChatMessage = { role: 'user', content: input }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsLoading(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const { extractUrls, fetchUrls } = await import('@/lib/ai/research')
      let researchResults: import('@/lib/ai/research').ResearchResult[] | undefined

      if (allowWebResearch) {
        const urls = extractUrls(input)
        if (urls.length > 0) {
          toast.info(`Fetching ${urls.length} URL(s)…`)
          researchResults = await fetchUrls(urls, controller.signal)
          const failed = researchResults.filter((r) => !r.success)
          if (failed.length > 0) {
            toast.warning(`Failed to fetch ${failed.length} URL(s)`)
          }
        }
      }

      const apiMessages = buildMessages(
        messages.filter((m) => m.role !== 'system'),
        input,
        entities,
        claims,
        augment,
        researchResults,
      )

      let streamedContent = ''
      setMessages((m) => [...m, { role: 'assistant', content: '' }])

      await sendChatStream(
        {
          provider,
          model: effectiveModel,
          apiKey,
          messages: apiMessages,
          signal: controller.signal,
          ollamaCpuOnly,
          ollamaBaseUrl,
        },
        (chunk) => {
          streamedContent += chunk
          setMessages((m) => {
            const updated = [...m]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: streamedContent,
            }
            return updated
          })
        },
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `[Error] ${msg}\n\nCheck your provider settings and try again.` },
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
          onClick={() => { setShowSettings(!showSettings) }}
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
                      const defaultModel = p === 'openrouter' ? DEFAULT_MODEL.openrouter : DEFAULT_MODEL.ollama
                      setModel(defaultModel)
                      setCustomModel('')
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
                  <div className="flex gap-1.5">
                    <select
                      value={model}
                      onChange={(e) => { setModel(e.target.value); setCustomModel('') }}
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                    >
                      {(provider === 'ollama' ? ollamaModels : activeProvider.models).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    {provider === 'ollama' && (
                      <button
                        onClick={() => { void handleRefreshOllamaModels() }}
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-border bg-background text-ink-faint transition-colors hover:border-saffron/40 hover:text-saffron focus-ring"
                        aria-label="Refresh Ollama models"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => { setCustomModel(e.target.value) }}
                    placeholder="Or type a custom model name"
                    className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] font-mono text-ink-soft placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                  />
                </Field>

                {activeProvider.requiresKey && (
                  <Field label="API Key" icon={Key}>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => { setApiKey(e.target.value) }}
                        placeholder="sk-or-…"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 pr-16 text-[12px] font-mono text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                      />
                      <button
                        onClick={() => { setShowKey(!showKey) }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-caption font-medium text-ink-faint hover:text-ink"
                      >
                        {showKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-caption text-ink-faint">
                      Stored in this browser only — sent directly to OpenRouter.
                    </p>
                  </Field>
                )}

                {provider === 'ollama' && (
                  <>
                    <Field label="Ollama Base URL" icon={Globe}>
                      <input
                        type="text"
                        value={ollamaBaseUrl}
                        onChange={(e) => { setOllamaBaseUrl(e.target.value) }}
                        placeholder={DEFAULT_OLLAMA_BASE_URL}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] font-mono text-ink-soft placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                      />
                    </Field>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5 text-saffron" />
                        <div>
                          <div className="text-[12px] font-medium text-ink">CPU only</div>
                          <div className="text-caption text-ink-faint">Disable GPU acceleration</div>
                        </div>
                      </div>
                      <button
                        onClick={() => { setOllamaCpuOnly(!ollamaCpuOnly) }}
                        className={cn(
                          'relative h-5 w-9 overflow-hidden rounded-full transition-colors',
                          ollamaCpuOnly ? 'bg-saffron' : 'bg-border',
                        )}
                        role="switch"
                        aria-checked={ollamaCpuOnly}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                            ollamaCpuOnly ? 'translate-x-[18px]' : 'translate-x-0',
                          )}
                        />
                      </button>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-saffron" />
                    <div>
                      <div className="text-[12px] font-medium text-ink">Augment with local knowledge</div>
                      <div className="text-caption text-ink-faint">BM25 retrieval over your entities</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setAugment(!augment) }}
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

                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-saffron" />
                    <div>
                      <div className="text-[12px] font-medium text-ink">Allow web research</div>
                      <div className="text-caption text-ink-faint">Fetch URLs via Jina Reader</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setAllowWebResearch(!allowWebResearch) }}
                    className={cn(
                      'relative h-5 w-9 overflow-hidden rounded-full transition-colors',
                      allowWebResearch ? 'bg-saffron' : 'bg-border',
                    )}
                    role="switch"
                    aria-checked={allowWebResearch}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                        allowWebResearch ? 'translate-x-[18px]' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>

                <button
                  onClick={() => {
                    saveAISettings({
                      provider,
                      model,
                      apiKey,
                      augmentWithLocal: augment,
                      ollamaCpuOnly,
                      allowWebResearch,
                      ollamaBaseUrl,
                    })
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
                <span className="font-mono text-ink-soft">{effectiveModel}</span>
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
                <span className="font-mono">{effectiveModel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
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
