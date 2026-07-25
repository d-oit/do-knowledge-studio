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
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import {
  sendChatStream,
  fetchOllamaModels,
  buildMessages,
  type ChatMessage,
  OPENROUTER_ROUTERS,
  OPENROUTER_MODELS,
  OPENROUTER_DEFAULT_TARGETS,
} from '@/lib/ai'
import {
  DEFAULT_MODEL,
  OLLAMA_DEFAULT_MODELS,
  DEFAULT_OLLAMA_BASE_URL,
} from '@/lib/ai/types'
import { Field, PROVIDERS } from './ai-harness-settings'
import { SwitchToggle } from '../ui/shared-primitives'

export function AIHarnessView() {
  const entities = useStudioStore((s) => s.entities)
  const claims = useStudioStore((s) => s.claims)
  const reducedMotion = useReducedMotion()
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

  const selectedEngineTarget = provider === 'openrouter'
    ? OPENROUTER_DEFAULT_TARGETS.find((t) => t.slug === effectiveModel)
    : null

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
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
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
            'flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium transition-colors hover:border-saffron/40 focus-ring min-h-[44px]',
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
            initial={reducedMotion ? false : { opacity: 0, x: -8 }}
            animate={reducedMotion ? undefined : { opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-4 font-serif text-[15px] font-semibold text-ink">Provider</h2>

              <div className="space-y-3">
                <Field label="Connect Local Database" icon={Database}>
                  <div
                    className="flex w-full items-center rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft"
                  >
                    <span className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Connected · {entities.length} entities
                    </span>
                  </div>
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

                <Field label="Engine" icon={Cpu}>
                  <div className="flex gap-1.5">
                    <select
                      value={model}
                      onChange={(e) => { setModel(e.target.value); setCustomModel('') }}
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                    >
                      {provider === 'ollama' ? (
                        ollamaModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))
                      ) : (
                        <>
                          <optgroup label="Routers">
                            {OPENROUTER_ROUTERS.map((r) => (
                              <option key={r.slug} value={r.slug}>
                                {r.display_name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Concrete Models">
                            {OPENROUTER_MODELS.map((m) => (
                              <option key={m.slug} value={m.slug}>
                                {m.display_name}
                              </option>
                            ))}
                          </optgroup>
                        </>
                      )}
                    </select>
                    {provider === 'ollama' && (
                      <button
                        onClick={() => { void handleRefreshOllamaModels() }}
                        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md border border-border bg-background text-ink-faint transition-colors hover:border-saffron/40 hover:text-saffron focus-ring"
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
                    placeholder="Or type a custom engine or model slug"
                    aria-label="Custom engine or model slug"
                    className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] font-mono text-ink-soft placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                  />
                  {selectedEngineTarget?.description && (
                    <div className="mt-2 rounded border border-border bg-muted/30 p-2 text-[11px] leading-relaxed text-ink-mute">
                      <strong className="text-ink-soft">{selectedEngineTarget.display_name}: </strong>
                      {selectedEngineTarget.description}
                    </div>
                  )}
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
                        className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-caption font-medium text-ink-faint hover:text-ink focus-ring"
                        aria-label={showKey ? 'Hide API key' : 'Show API key'}
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

                    <SwitchToggle
                      label="CPU only"
                      description="Disable GPU acceleration"
                      icon={Cpu}
                      checked={ollamaCpuOnly}
                      onToggle={() => { setOllamaCpuOnly(!ollamaCpuOnly) }}
                    />
                  </>
                )}

                <SwitchToggle
                  label="Augment with local knowledge"
                  description="BM25 retrieval over your entities"
                  icon={BookOpen}
                  checked={augment}
                  onToggle={() => { setAugment(!augment) }}
                />

                <SwitchToggle
                  label="Allow web research"
                  description="Fetch URLs via Jina Reader"
                  icon={Globe}
                  checked={allowWebResearch}
                  onToggle={() => { setAllowWebResearch(!allowWebResearch) }}
                />
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
                  className="w-full rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring min-h-[44px]"
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
                  Active engine
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
        </div>
      </div>
    </div>
  )
}
