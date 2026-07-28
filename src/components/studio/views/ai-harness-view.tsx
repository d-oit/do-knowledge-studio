'use client'

import { useStudioStore } from '@/lib/studio/store'
import { FlaskConical, Settings } from 'lucide-react'
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
  OPENROUTER_DEFAULT_TARGETS,
} from '@/lib/ai'
import { OLLAMA_DEFAULT_MODELS, DEFAULT_OLLAMA_BASE_URL } from '@/lib/ai/types'
import { AiHarnessSettingsPanel } from './ai-harness-settings-panel'
import { AiHarnessChatPanel } from './ai-harness-chat'
import { PROVIDERS } from './ai-harness-settings'
import { useRateLimiter } from '@/lib/ai'

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
  const [cooldownMs, setCooldownMs] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const { canRequest } = useRateLimiter()

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
    }).catch((err) => {
      console.error('Failed to save AI settings:', err)
      toast.error('Failed to save settings. Your changes may not persist.')
    })
  }, [provider, model, apiKey, augment, ollamaCpuOnly, allowWebResearch, ollamaBaseUrl, settingsLoaded])

  useEffect(() => {
    if (cooldownMs <= 0) return
    const timer = setTimeout(() => { setCooldownMs((ms) => Math.max(0, ms - 1000)) }, 1000)
    return () => { clearTimeout(timer) }
  }, [cooldownMs])

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
    ? OPENROUTER_DEFAULT_TARGETS.find((t) => t.slug === effectiveModel) ?? null
    : null
  const activeProvider = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0]

  const handleSend = async () => {
    if (!input.trim()) return
    if (!apiKey && activeProvider.requiresKey) {
      toast.error('Set an API key in settings to send messages.')
      return
    }

    const decision = canRequest()
    if (!decision.allowed) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: "I\u2019m being rate-limited \u2014 please slow down and try again in a few seconds.",
        },
      ])
      setCooldownMs(decision.retryAfterMs ?? 5000)
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
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, x: -8 }}
            animate={reducedMotion ? undefined : { opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <AiHarnessSettingsPanel
              provider={provider}
              setProvider={setProvider}
              model={model}
              setModel={setModel}
              apiKey={apiKey}
              setApiKey={setApiKey}
              showKey={showKey}
              setShowKey={setShowKey}
              augment={augment}
              setAugment={setAugment}
              ollamaCpuOnly={ollamaCpuOnly}
              setOllamaCpuOnly={setOllamaCpuOnly}
              ollamaBaseUrl={ollamaBaseUrl}
              setOllamaBaseUrl={setOllamaBaseUrl}
              allowWebResearch={allowWebResearch}
              setAllowWebResearch={setAllowWebResearch}
              customModel={customModel}
              setCustomModel={setCustomModel}
              ollamaModels={ollamaModels}
              handleRefreshOllamaModels={() => { void handleRefreshOllamaModels() }}
              entityCount={entities.length}
              effectiveModel={effectiveModel}
              selectedEngineTarget={selectedEngineTarget}
              isLoading={isLoading}
            />
          </motion.div>
        )}

        <div className={cn('flex flex-col', showSettings ? 'lg:col-span-3' : 'lg:col-span-5')}>
          <AiHarnessChatPanel
            messages={messages}
            isLoading={isLoading}
            input={input}
            setInput={setInput}
            handleSend={() => { void handleSend() }}
            reducedMotion={reducedMotion}
            augment={augment}
            effectiveModel={effectiveModel}
            cooldownMs={cooldownMs}
          />
        </div>
      </div>
    </div>
  )
}
